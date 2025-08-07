import { v4 as uuidv4 } from 'uuid';
import * as jsonpath from 'jsonpath';
import { 
  APICall, 
  MacroRecording, 
  MacroParameter, 
  MacroAnalysis, 
  ToolDefinition,
  IMacroRecorder,
  RecorderState,
  MacroPlaybackOptions
} from './types.js';
import { MacroStorage } from './storage.js';
import { MacroAnalyzer } from './analyzer.js';
import { ToolGenerator } from './generator.js';
import { OPNSenseAPIClient } from '../api/client.js';

export class MacroRecorder implements IMacroRecorder {
  private state: RecorderState = {
    isRecording: false,
    callCount: 0
  };
  
  private storage: MacroStorage;
  private analyzer: MacroAnalyzer;
  private generator: ToolGenerator;
  private client: OPNSenseAPIClient;
  
  constructor(client: OPNSenseAPIClient, storagePath?: string) {
    this.client = client;
    this.storage = new MacroStorage(storagePath);
    this.analyzer = new MacroAnalyzer();
    this.generator = new ToolGenerator();
  }
  
  // Recording control
  startRecording(name: string, description: string): void {
    if (this.state.isRecording) {
      throw new Error('Already recording. Stop current recording first.');
    }
    
    this.state = {
      isRecording: true,
      currentRecording: {
        id: uuidv4(),
        name,
        description,
        created: new Date(),
        updated: new Date(),
        calls: [],
        parameters: [],
        metadata: {}
      },
      callCount: 0,
      startTime: Date.now()
    };
  }
  
  stopRecording(): MacroRecording | null {
    if (!this.state.isRecording || !this.state.currentRecording) {
      return null;
    }
    
    const recording = this.state.currentRecording;
    recording.updated = new Date();
    
    // Auto-detect parameters
    const analysis = this.analyzer.analyzeMacro(recording);
    recording.parameters = analysis.parameterSuggestions;
    
    this.state = {
      isRecording: false,
      callCount: 0
    };
    
    return recording;
  }
  
  pauseRecording(): void {
    if (!this.state.isRecording) {
      throw new Error('Not currently recording');
    }
    this.state.isRecording = false;
  }
  
  resumeRecording(): void {
    if (!this.state.currentRecording) {
      throw new Error('No recording to resume');
    }
    this.state.isRecording = true;
  }
  
  clearRecording(): void {
    this.state = {
      isRecording: false,
      callCount: 0
    };
  }
  
  // Recording state
  isRecording(): boolean {
    return this.state.isRecording;
  }
  
  getCurrentRecording(): MacroRecording | null {
    return this.state.currentRecording || null;
  }
  
  // API call recording
  recordAPICall(call: Omit<APICall, 'id' | 'timestamp'>): void {
    if (!this.state.isRecording || !this.state.currentRecording) {
      return; // Silently ignore if not recording
    }
    
    const recordedCall: APICall = {
      ...call,
      id: uuidv4(),
      timestamp: Date.now()
    };
    
    this.state.currentRecording.calls.push(recordedCall);
    this.state.callCount++;
    this.state.currentRecording.updated = new Date();
  }
  
  // Macro management
  async saveMacro(recording: MacroRecording): Promise<void> {
    await this.storage.save(recording);
  }
  
  async loadMacro(id: string): Promise<MacroRecording | null> {
    return await this.storage.load(id);
  }
  
  async listMacros(): Promise<MacroRecording[]> {
    return await this.storage.list();
  }
  
  async deleteMacro(id: string): Promise<void> {
    await this.storage.delete(id);
  }
  
  // Analysis and generation
  analyzeMacro(recording: MacroRecording): MacroAnalysis {
    return this.analyzer.analyzeMacro(recording);
  }
  
  generateTool(recording: MacroRecording): ToolDefinition {
    return this.generator.generateTool(recording);
  }
  
  // Playback
  async playMacro(id: string, options?: MacroPlaybackOptions): Promise<any[]> {
    const macro = await this.loadMacro(id);
    if (!macro) {
      throw new Error(`Macro ${id} not found`);
    }
    
    const results: any[] = [];
    const params = options?.parameters || {};
    
    for (const call of macro.calls) {
      try {
        // Apply parameter substitution
        const processedCall = this.substituteParameters(call, macro.parameters, params);
        
        // Allow pre-processing
        const finalCall = options?.beforeCall 
          ? await options.beforeCall(processedCall) 
          : processedCall;
        
        if (!finalCall) continue; // Skip if beforeCall returns null
        
        // Execute if not dry run
        if (!options?.dryRun) {
          const startTime = Date.now();
          let response;
          
          switch (finalCall.method) {
            case 'GET':
              response = await this.client.get(finalCall.path);
              break;
            case 'POST':
              response = await this.client.post(finalCall.path, finalCall.payload);
              break;
            case 'PUT':
              response = await this.client.put(finalCall.path, finalCall.payload);
              break;
            case 'DELETE':
              response = await this.client.delete(finalCall.path);
              break;
          }
          
          const duration = Date.now() - startTime;
          
          // Record the result
          const result = {
            call: finalCall,
            response,
            duration
          };
          
          results.push(result);
          
          // Allow post-processing
          if (options?.afterCall) {
            await options.afterCall(finalCall, response);
          }
        } else {
          // Dry run - just collect the calls
          results.push({
            call: finalCall,
            response: null,
            duration: 0,
            dryRun: true
          });
        }
      } catch (error) {
        if (options?.stopOnError) {
          throw error;
        }
        results.push({
          call,
          error,
          duration: 0
        });
      }
    }
    
    return results;
  }
  
  // Helper methods
  private substituteParameters(
    call: APICall, 
    parameters: MacroParameter[], 
    values: Record<string, any>
  ): APICall {
    // Deep clone the call object
    const substitutedCall = JSON.parse(JSON.stringify(call));
    
    // Create a context object that includes all values plus any response data
    const context = {
      ...values,
      $: values  // Allow $ as root context for JSONPath expressions
    };
    
    // Convert call to string for pattern matching
    const callStr = JSON.stringify(substitutedCall);
    
    // Find all template expressions in the call
    const templateRegex = /\{\{([^}]+)\}\}/g;
    let modifiedStr = callStr;
    let match;
    
    while ((match = templateRegex.exec(callStr)) !== null) {
      const expression = match[1].trim();
      let value;
      
      if (expression.startsWith('$')) {
        // JSONPath expression
        try {
          const results = jsonpath.query(context, expression);
          value = results.length > 0 ? results[0] : match[0]; // Keep original if no match
        } catch (error) {
          console.warn(`Invalid JSONPath expression: ${expression}`, error);
          value = match[0]; // Keep original on error
        }
      } else {
        // Simple variable substitution
        const param = parameters.find(p => p.name === expression);
        value = values[expression] ?? param?.defaultValue;
      }
      
      if (value !== undefined && value !== match[0]) {
        // Replace the template with the value
        modifiedStr = modifiedStr.replace(match[0], JSON.stringify(value));
      }
    }
    
    return JSON.parse(modifiedStr);
  }
  
  // Advanced features
  
  /**
   * Create a macro from a sequence of tool calls
   */
  async createMacroFromTools(
    name: string,
    description: string,
    toolCalls: Array<{ tool: string; args: any }>
  ): Promise<MacroRecording> {
    this.startRecording(name, description);
    
    // Execute and record each tool call
    for (const { tool, args } of toolCalls) {
      // This would need access to tool implementations
      // For now, we'll simulate it
      this.recordAPICall({
        method: 'POST',
        path: `/tool/${tool}`,
        payload: args,
        metadata: {
          description: `Tool call: ${tool}`,
          category: 'tool'
        }
      });
    }
    
    const recording = this.stopRecording();
    if (!recording) {
      throw new Error('Failed to create recording');
    }
    
    await this.saveMacro(recording);
    return recording;
  }
  
  /**
   * Compare two macros to find differences
   */
  compareMacros(macro1: MacroRecording, macro2: MacroRecording): {
    added: APICall[];
    removed: APICall[];
    modified: Array<{ old: APICall; new: APICall }>;
  } {
    // Simple comparison based on path and method
    const calls1Map = new Map(macro1.calls.map(c => [`${c.method}:${c.path}`, c]));
    const calls2Map = new Map(macro2.calls.map(c => [`${c.method}:${c.path}`, c]));
    
    const added: APICall[] = [];
    const removed: APICall[] = [];
    const modified: Array<{ old: APICall; new: APICall }> = [];
    
    // Find added and modified
    for (const [key, call2] of calls2Map) {
      const call1 = calls1Map.get(key);
      if (!call1) {
        added.push(call2);
      } else if (JSON.stringify(call1.payload) !== JSON.stringify(call2.payload)) {
        modified.push({ old: call1, new: call2 });
      }
    }
    
    // Find removed
    for (const [key, call1] of calls1Map) {
      if (!calls2Map.has(key)) {
        removed.push(call1);
      }
    }
    
    return { added, removed, modified };
  }
  
  /**
   * Merge multiple macros into one
   */
  mergeMacros(
    name: string,
    description: string,
    macros: MacroRecording[]
  ): MacroRecording {
    const merged: MacroRecording = {
      id: uuidv4(),
      name,
      description,
      created: new Date(),
      updated: new Date(),
      calls: [],
      parameters: [],
      metadata: {
        tags: ['merged'],
        version: '1.0'
      }
    };
    
    // Combine all calls
    for (const macro of macros) {
      merged.calls.push(...macro.calls);
    }
    
    // Combine and deduplicate parameters
    const paramMap = new Map<string, MacroParameter>();
    for (const macro of macros) {
      for (const param of macro.parameters) {
        if (!paramMap.has(param.name)) {
          paramMap.set(param.name, param);
        }
      }
    }
    merged.parameters = Array.from(paramMap.values());
    
    return merged;
  }
}