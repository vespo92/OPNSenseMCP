/**
 * Types and interfaces for the API Macro Recording system
 */

export interface APICall {
  id: string;
  timestamp: number;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  params?: Record<string, any>;
  payload?: any;
  response?: {
    status: number;
    data: any;
    headers?: Record<string, string>;
  };
  error?: {
    code: string;
    message: string;
  };
  duration?: number;
  metadata?: {
    description?: string;
    category?: string;
    tags?: string[];
  };
}

export interface MacroRecording {
  id: string;
  name: string;
  description: string;
  created: Date;
  updated: Date;
  calls: APICall[];
  parameters: MacroParameter[];
  metadata: {
    category?: string;
    tags?: string[];
    author?: string;
    version?: string;
  };
}

export interface MacroParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
  defaultValue?: any;
  examples?: any[];
  path: string; // JSONPath to the parameter in the API calls
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    enum?: any[];
  };
}

export interface MacroPlaybackOptions {
  parameters?: Record<string, any>;
  dryRun?: boolean;
  stopOnError?: boolean;
  beforeCall?: (call: APICall) => Promise<APICall | null>;
  afterCall?: (call: APICall, response: any) => Promise<void>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  implementation?: string; // Generated implementation code
}

export interface MacroAnalysis {
  patterns: {
    creates?: string[];  // Resource types created
    reads?: string[];    // Resource types read
    updates?: string[];  // Resource types updated
    deletes?: string[]; // Resource types deleted
  };
  dependencies: string[]; // Other macros or tools this depends on
  sideEffects: string[]; // Detected side effects
  parameterSuggestions: MacroParameter[];
  toolSuggestion: ToolDefinition;
}

export interface RecorderState {
  isRecording: boolean;
  currentRecording?: MacroRecording;
  callCount: number;
  startTime?: number;
}

export type RecorderEvent = 
  | { type: 'START_RECORDING'; name: string; description: string }
  | { type: 'STOP_RECORDING' }
  | { type: 'API_CALL'; call: APICall }
  | { type: 'PAUSE_RECORDING' }
  | { type: 'RESUME_RECORDING' }
  | { type: 'ADD_PARAMETER'; parameter: MacroParameter }
  | { type: 'CLEAR_RECORDING' };

export interface IMacroRecorder {
  // Recording control
  startRecording(name: string, description: string): void;
  stopRecording(): MacroRecording | null;
  pauseRecording(): void;
  resumeRecording(): void;
  clearRecording(): void;
  
  // Recording state
  isRecording(): boolean;
  getCurrentRecording(): MacroRecording | null;
  
  // API call recording
  recordAPICall(call: Omit<APICall, 'id' | 'timestamp'>): void;
  
  // Macro management
  saveMacro(recording: MacroRecording): Promise<void>;
  loadMacro(id: string): Promise<MacroRecording | null>;
  listMacros(): Promise<MacroRecording[]>;
  deleteMacro(id: string): Promise<void>;
  
  // Analysis and generation
  analyzeMacro(recording: MacroRecording): MacroAnalysis;
  generateTool(recording: MacroRecording): ToolDefinition;
  
  // Playback
  playMacro(id: string, options?: MacroPlaybackOptions): Promise<any[]>;
}

export interface IMacroStorage {
  save(macro: MacroRecording): Promise<void>;
  load(id: string): Promise<MacroRecording | null>;
  list(): Promise<MacroRecording[]>;
  delete(id: string): Promise<void>;
  search(query: {
    name?: string;
    tags?: string[];
    category?: string;
  }): Promise<MacroRecording[]>;
}