import { 
  APICall, 
  MacroRecording, 
  MacroParameter, 
  MacroAnalysis 
} from './types.js';

export class MacroAnalyzer {
  /**
   * Analyze a macro recording to extract patterns and suggest parameters
   */
  analyzeMacro(recording: MacroRecording): MacroAnalysis {
    const analysis: MacroAnalysis = {
      patterns: {
        creates: [],
        reads: [],
        updates: [],
        deletes: []
      },
      dependencies: [],
      sideEffects: [],
      parameterSuggestions: [],
      toolSuggestion: {
        name: this.generateToolName(recording.name),
        description: recording.description,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    };
    
    // Analyze each API call
    for (const call of recording.calls) {
      this.analyzeCall(call, analysis);
    }
    
    // Detect parameters from variable values
    analysis.parameterSuggestions = this.detectParameters(recording.calls);
    
    // Update tool suggestion with parameters
    this.updateToolSuggestion(analysis);
    
    return analysis;
  }
  
  private analyzeCall(call: APICall, analysis: MacroAnalysis): void {
    const pathParts = call.path.split('/').filter(p => p);
    
    // Detect resource types and operations
    if (pathParts.length >= 3) {
      const resource = pathParts[2]; // e.g., 'haproxy', 'firewall', etc.
      const operation = pathParts[3]; // e.g., 'settings', 'service', etc.
      
      // Categorize by HTTP method and path patterns
      if (call.method === 'POST') {
        if (call.path.includes('/add') || call.path.includes('/create')) {
          if (!analysis.patterns.creates?.includes(resource)) {
            analysis.patterns.creates?.push(resource);
          }
        } else if (call.path.includes('/set') || call.path.includes('/update')) {
          if (!analysis.patterns.updates?.includes(resource)) {
            analysis.patterns.updates?.push(resource);
          }
        } else if (call.path.includes('/del') || call.path.includes('/delete')) {
          if (!analysis.patterns.deletes?.includes(resource)) {
            analysis.patterns.deletes?.push(resource);
          }
        }
      } else if (call.method === 'GET') {
        if (call.path.includes('/search') || call.path.includes('/list') || call.path.includes('/get')) {
          if (!analysis.patterns.reads?.includes(resource)) {
            analysis.patterns.reads?.push(resource);
          }
        }
      }
      
      // Detect service operations as side effects
      if (call.path.includes('/service/') && call.method === 'POST') {
        const action = pathParts[pathParts.length - 1];
        analysis.sideEffects.push(`${resource} service ${action}`);
      }
    }
    
    // Detect dependencies from response data
    if (call.response?.data?.uuid) {
      // This call created something that might be referenced later
      analysis.dependencies.push(`${call.path} -> uuid:${call.response.data.uuid}`);
    }
  }
  
  private detectParameters(calls: APICall[]): MacroParameter[] {
    const parameters: MacroParameter[] = [];
    const valueOccurrences = new Map<string, Array<{ path: string; context: string }>>();
    
    // Collect all string and number values
    for (const call of calls) {
      this.collectValues(call.payload, '', valueOccurrences);
      if (call.path.includes('{{') && call.path.includes('}}')) {
        // Path contains template variables
        const matches = call.path.match(/\{\{(\w+)\}\}/g);
        if (matches) {
          for (const match of matches) {
            const paramName = match.slice(2, -2);
            parameters.push({
              name: paramName,
              type: 'string',
              required: true,
              path: `path`,
              description: `Parameter used in API path`
            });
          }
        }
      }
    }
    
    // Analyze value patterns
    for (const [value, occurrences] of valueOccurrences) {
      if (occurrences.length > 1 || this.looksLikeVariable(value)) {
        // This value appears multiple times or looks like it should be parameterized
        const param = this.createParameter(value, occurrences);
        if (param && !parameters.some(p => p.name === param.name)) {
          parameters.push(param);
        }
      }
    }
    
    return parameters;
  }
  
  private collectValues(
    obj: any, 
    path: string, 
    occurrences: Map<string, Array<{ path: string; context: string }>>
  ): void {
    if (obj === null || obj === undefined) return;
    
    if (typeof obj === 'string' || typeof obj === 'number') {
      const strValue = String(obj);
      if (strValue.length > 2 && !this.isCommonValue(strValue)) {
        if (!occurrences.has(strValue)) {
          occurrences.set(strValue, []);
        }
        occurrences.get(strValue)!.push({ path, context: this.getContext(path) });
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.collectValues(item, `${path}[${index}]`, occurrences);
      });
    } else if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        this.collectValues(value, path ? `${path}.${key}` : key, occurrences);
      }
    }
  }
  
  private looksLikeVariable(value: string): boolean {
    // Check if value looks like it should be parameterized
    const patterns = [
      /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/, // IP address
      /^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/, // Domain name
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID
      /^\/.*\/.*$/, // Path
      /^[A-Z][a-zA-Z0-9]*$/, // PascalCase identifier
      /^[a-z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)*$/ // kebab-case identifier
    ];
    
    return patterns.some(pattern => pattern.test(value));
  }
  
  private isCommonValue(value: string): boolean {
    const common = ['true', 'false', '0', '1', 'enabled', 'disabled', 'on', 'off', 'yes', 'no'];
    return common.includes(value.toLowerCase());
  }
  
  private createParameter(
    value: string, 
    occurrences: Array<{ path: string; context: string }>
  ): MacroParameter | null {
    const context = occurrences[0].context;
    const type = this.inferType(value);
    
    // Generate parameter name from context
    const name = this.generateParameterName(context, value);
    if (!name) return null;
    
    const param: MacroParameter = {
      name,
      type,
      required: true,
      path: occurrences[0].path,
      description: `Parameter for ${context}`,
      examples: [value]
    };
    
    // Add validation based on type
    if (type === 'string') {
      if (this.looksLikeIP(value)) {
        param.validation = { pattern: '^[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}$' };
        param.description = 'IP address';
      } else if (this.looksLikeDomain(value)) {
        param.validation = { pattern: '^[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$' };
        param.description = 'Domain name';
      } else if (this.looksLikeUUID(value)) {
        param.validation = { pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' };
        param.description = 'UUID';
      }
    } else if (type === 'number') {
      const num = Number(value);
      if (num >= 1 && num <= 65535) {
        param.validation = { minimum: 1, maximum: 65535 };
        param.description = 'Port number';
      }
    }
    
    return param;
  }
  
  private inferType(value: string): 'string' | 'number' | 'boolean' | 'object' | 'array' {
    if (value === 'true' || value === 'false') return 'boolean';
    if (!isNaN(Number(value))) return 'number';
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return 'array';
      if (typeof parsed === 'object') return 'object';
    } catch {}
    return 'string';
  }
  
  private generateParameterName(context: string, value: string): string | null {
    // Clean up context path
    const parts = context.split('.').filter(p => p && !p.match(/^\d+$/));
    if (parts.length === 0) return null;
    
    // Use the last meaningful part
    let name = parts[parts.length - 1];
    
    // Convert to camelCase
    name = name.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase());
    
    // Add type suffix if helpful
    if (this.looksLikeIP(value) && !name.includes('address') && !name.includes('ip')) {
      name += 'Address';
    } else if (this.looksLikePort(value) && !name.includes('port')) {
      name += 'Port';
    } else if (this.looksLikeUUID(value) && !name.includes('id') && !name.includes('uuid')) {
      name += 'Id';
    }
    
    return name;
  }
  
  private getContext(path: string): string {
    // Get the last meaningful part of the path
    const parts = path.split('.');
    return parts.filter(p => p && !p.match(/^\[?\d+\]?$/)).pop() || path;
  }
  
  private looksLikeIP(value: string): boolean {
    return /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/.test(value);
  }
  
  private looksLikeDomain(value: string): boolean {
    return /^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(value);
  }
  
  private looksLikeUUID(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }
  
  private looksLikePort(value: string): boolean {
    const num = Number(value);
    return !isNaN(num) && num >= 1 && num <= 65535;
  }
  
  private generateToolName(macroName: string): string {
    // Convert macro name to snake_case tool name
    return macroName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
  
  private updateToolSuggestion(analysis: MacroAnalysis): void {
    const tool = analysis.toolSuggestion;
    
    // Add parameters to tool schema
    for (const param of analysis.parameterSuggestions) {
      const prop: any = {
        type: param.type,
        description: param.description
      };
      
      if (param.validation) {
        if (param.validation.pattern) prop.pattern = param.validation.pattern;
        if (param.validation.minimum !== undefined) prop.minimum = param.validation.minimum;
        if (param.validation.maximum !== undefined) prop.maximum = param.validation.maximum;
        if (param.validation.enum) prop.enum = param.validation.enum;
      }
      
      if (param.defaultValue !== undefined) {
        prop.default = param.defaultValue;
      }
      
      tool.inputSchema.properties[param.name] = prop;
      
      if (param.required) {
        tool.inputSchema.required = tool.inputSchema.required || [];
        tool.inputSchema.required.push(param.name);
      }
    }
  }
}