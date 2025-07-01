import { 
  MacroRecording, 
  ToolDefinition, 
  APICall,
  MacroParameter 
} from './types.js';

export class ToolGenerator {
  /**
   * Generate a complete MCP tool definition from a macro recording
   */
  generateTool(recording: MacroRecording): ToolDefinition {
    const toolName = this.generateToolName(recording.name);
    
    const tool: ToolDefinition = {
      name: toolName,
      description: recording.description || `Generated from macro: ${recording.name}`,
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
    
    // Add parameters to schema
    for (const param of recording.parameters) {
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
    
    // Generate implementation code
    tool.implementation = this.generateImplementation(recording, toolName);
    
    return tool;
  }
  
  /**
   * Generate TypeScript implementation code for the tool
   */
  generateImplementation(recording: MacroRecording, toolName: string): string {
    const imports = this.generateImports();
    const parameterInterface = this.generateParameterInterface(recording);
    const toolHandler = this.generateToolHandler(recording, toolName);
    
    return `${imports}\n\n${parameterInterface}\n\n${toolHandler}`;
  }
  
  private generateImports(): string {
    return `import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { HAProxyResource } from './resources/services/haproxy/index.js';
import { OPNSenseAPIClient } from './api/client.js';`;
  }
  
  private generateParameterInterface(recording: MacroRecording): string {
    if (recording.parameters.length === 0) {
      return '';
    }
    
    const interfaceName = this.toPascalCase(recording.name) + 'Params';
    let code = `interface ${interfaceName} {\n`;
    
    for (const param of recording.parameters) {
      const optional = param.required ? '' : '?';
      const type = this.getTypeScriptType(param);
      code += `  ${param.name}${optional}: ${type};\n`;
    }
    
    code += '}';
    return code;
  }
  
  private generateToolHandler(recording: MacroRecording, toolName: string): string {
    const hasParams = recording.parameters.length > 0;
    const paramTypeName = hasParams ? this.toPascalCase(recording.name) + 'Params' : 'any';
    
    let code = `case '${toolName}': {\n`;
    
    // Add resource check
    code += `  if (!this.haproxyResource) {
    throw new McpError(
      ErrorCode.InternalError,
      'Not configured. Use configure tool first.'
    );
  }\n\n`;
    
    // Add parameter validation
    if (hasParams) {
      code += this.generateParameterValidation(recording);
    }
    
    // Add try-catch block
    code += `  try {\n`;
    
    // Generate API calls
    code += this.generateAPICalls(recording);
    
    // Generate return statement
    code += this.generateReturnStatement(recording);
    
    code += `  } catch (error: any) {
    throw new McpError(
      ErrorCode.InternalError,
      error.message
    );
  }
}`;
    
    return code;
  }
  
  private generateParameterValidation(recording: MacroRecording): string {
    let code = '';
    
    const requiredParams = recording.parameters.filter(p => p.required);
    if (requiredParams.length > 0) {
      const conditions = requiredParams.map(p => `!args.${p.name}`).join(' || ');
      code += `  if (!args || ${conditions}) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      '${requiredParams.map(p => p.name).join(', ')} parameter(s) required'
    );
  }\n\n`;
    }
    
    // Add specific validation for each parameter
    for (const param of recording.parameters) {
      if (param.validation) {
        code += this.generateParamValidation(param);
      }
    }
    
    return code;
  }
  
  private generateParamValidation(param: MacroParameter): string {
    let code = '';
    
    if (param.validation?.pattern) {
      code += `  if (args.${param.name} && !/${param.validation.pattern}/.test(args.${param.name})) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      '${param.name} must match pattern: ${param.validation.pattern}'
    );
  }\n`;
    }
    
    if (param.validation?.minimum !== undefined || param.validation?.maximum !== undefined) {
      const min = param.validation.minimum;
      const max = param.validation.maximum;
      if (min !== undefined && max !== undefined) {
        code += `  if (args.${param.name} !== undefined && (args.${param.name} < ${min} || args.${param.name} > ${max})) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      '${param.name} must be between ${min} and ${max}'
    );
  }\n`;
      }
    }
    
    if (param.validation?.enum) {
      const enumStr = param.validation.enum.map(v => `'${v}'`).join(', ');
      code += `  if (args.${param.name} && ![${enumStr}].includes(args.${param.name})) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      '${param.name} must be one of: ${param.validation.enum.join(', ')}'
    );
  }\n`;
    }
    
    return code;
  }
  
  private generateAPICalls(recording: MacroRecording): string {
    let code = '';
    const resultVars: string[] = [];
    
    for (let i = 0; i < recording.calls.length; i++) {
      const call = recording.calls[i];
      const varName = `result${i + 1}`;
      resultVars.push(varName);
      
      code += this.generateSingleAPICall(call, varName, recording.parameters);
      code += '\n';
    }
    
    return code;
  }
  
  private generateSingleAPICall(
    call: APICall, 
    varName: string, 
    parameters: MacroParameter[]
  ): string {
    let code = `    const ${varName} = await `;
    
    // Determine the method to call
    const pathWithParams = this.substitutePathParameters(call.path, parameters);
    
    switch (call.method) {
      case 'GET':
        code += `this.client.get('${pathWithParams}')`;
        break;
      case 'POST':
        const payload = this.generatePayload(call.payload, parameters);
        code += `this.client.post('${pathWithParams}', ${payload})`;
        break;
      case 'PUT':
        const putPayload = this.generatePayload(call.payload, parameters);
        code += `this.client.put('${pathWithParams}', ${putPayload})`;
        break;
      case 'DELETE':
        code += `this.client.delete('${pathWithParams}')`;
        break;
    }
    
    code += ';';
    
    // Add comment about what this call does
    if (call.metadata?.description) {
      code = `    // ${call.metadata.description}\n${code}`;
    }
    
    return code;
  }
  
  private substitutePathParameters(path: string, parameters: MacroParameter[]): string {
    let substitutedPath = path;
    
    // Replace template variables with TypeScript template literals
    for (const param of parameters) {
      const placeholder = `{{${param.name}}}`;
      if (substitutedPath.includes(placeholder)) {
        substitutedPath = substitutedPath.replace(
          placeholder,
          `\${args.${param.name}}`
        );
      }
    }
    
    // If path contains substitutions, wrap in backticks
    if (substitutedPath.includes('${')) {
      return '`' + substitutedPath + '`';
    }
    
    return `'${substitutedPath}'`;
  }
  
  private generatePayload(payload: any, parameters: MacroParameter[]): string {
    if (!payload) {
      return '{}';
    }
    
    // Convert payload to string for substitution
    let payloadStr = JSON.stringify(payload, null, 2);
    
    // Replace parameter placeholders
    for (const param of parameters) {
      const placeholder = `"{{${param.name}}}"`;
      if (payloadStr.includes(placeholder)) {
        // Remove quotes for non-string types
        if (param.type !== 'string') {
          payloadStr = payloadStr.replace(
            placeholder,
            `args.${param.name}`
          );
        } else {
          payloadStr = payloadStr.replace(
            placeholder,
            `args.${param.name} as string`
          );
        }
      }
    }
    
    return payloadStr;
  }
  
  private generateReturnStatement(recording: MacroRecording): string {
    // Determine what to return based on the macro
    const lastCall = recording.calls[recording.calls.length - 1];
    
    if (lastCall?.response?.data?.uuid) {
      // Return UUID if the last call created something
      return `    return {
      content: [{
        type: 'text',
        text: \`Successfully completed ${recording.name}. UUID: \${result${recording.calls.length}.uuid}\`
      }]
    };\n`;
    } else if (lastCall?.method === 'GET') {
      // Return data if the last call was a GET
      return `    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result${recording.calls.length}, null, 2)
      }]
    };\n`;
    } else {
      // Generic success message
      return `    return {
      content: [{
        type: 'text',
        text: 'Successfully completed ${recording.name}'
      }]
    };\n`;
    }
  }
  
  private generateToolName(macroName: string): string {
    return macroName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
  
  private toPascalCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
  
  private getTypeScriptType(param: MacroParameter): string {
    switch (param.type) {
      case 'string':
        return param.validation?.enum 
          ? param.validation.enum.map(v => `'${v}'`).join(' | ')
          : 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'any[]';
      case 'object':
        return 'Record<string, any>';
      default:
        return 'any';
    }
  }
  
  /**
   * Generate a complete tool module file
   */
  generateToolModule(recording: MacroRecording): string {
    const tool = this.generateTool(recording);
    const className = this.toPascalCase(recording.name) + 'Tool';
    
    return `/**
 * Generated MCP tool from macro: ${recording.name}
 * Created: ${new Date().toISOString()}
 * Description: ${recording.description}
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { OPNSenseAPIClient } from '../api/client.js';

${tool.implementation}

export const ${className}Definition = ${JSON.stringify(tool, null, 2)};

export class ${className} {
  constructor(private client: OPNSenseAPIClient) {}
  
  async execute(args: any): Promise<any> {
    ${this.extractToolBody(tool.implementation || '')}
  }
}
`;
  }
  
  private extractToolBody(implementation: string): string {
    // Extract the body of the case statement
    const match = implementation.match(/case '[^']+': \{([\s\S]+)\}/);
    return match ? match[1].trim() : '';
  }
}