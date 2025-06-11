// This file contains the fixes needed to complete Phase 1

// Fix 1: Add the missing applyResource tool to the MCP server
export const applyResourceTool = {
  name: 'applyResource',
  description: 'Apply a single resource (create, update, or delete)',
  inputSchema: {
    type: 'object',
    properties: {
      resource: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          name: { type: 'string' },
          properties: { type: 'object' },
          dependencies: { 
            type: 'array', 
            items: { type: 'string' } 
          }
        },
        required: ['type', 'name', 'properties']
      },
      action: {
        type: 'string',
        enum: ['create', 'update', 'delete']
      }
    },
    required: ['resource', 'action']
  }
};

// Fix 2: Update ResourceExecutor to handle plan reconstruction
export function reconstructResourceFromPlan(resourceData: any, registry: any): any {
  // Reconstruct a proper Resource instance from plan data
  return registry.create(
    resourceData.type,
    resourceData.name,
    resourceData.properties,
    resourceData.dependencies
  );
}

// Fix 3: Handler for applyResource
export async function handleApplyResource(args: any, executor: any, registry: any) {
  if (!args || !args.resource || !args.action) {
    throw new Error('Resource and action required');
  }

  // Create a proper resource instance
  const resource = registry.create(
    args.resource.type,
    args.resource.name,
    args.resource.properties,
    args.resource.dependencies || []
  );

  // Validate the resource first
  const validation = resource.validate();
  if (!validation.valid) {
    throw new Error(`Resource validation failed: ${JSON.stringify(validation.errors)}`);
  }

  // Execute the action
  let result;
  switch (args.action) {
    case 'create':
      result = await executor.createResource(resource);
      break;
    case 'update':
      result = await executor.updateResource(resource);
      break;
    case 'delete':
      result = await executor.deleteResource(resource);
      break;
    default:
      throw new Error(`Unknown action: ${args.action}`);
  }

  return {
    success: true,
    action: args.action,
    resource: {
      id: resource.id,
      type: resource.type,
      name: resource.name,
      state: resource.state,
      outputs: resource.outputs
    },
    result
  };
}

// Fix 4: Update the executor's execute method to reconstruct resources
export function fixExecutor(executor: any) {
  const originalExecuteAction = executor.executeAction.bind(executor);
  
  executor.executeAction = async function(action: any) {
    // If action.resource is a plain object, reconstruct it
    if (action.resource && !action.resource.validate) {
      action.resource = reconstructResourceFromPlan(
        action.resource, 
        this.registry
      );
    }
    
    return originalExecuteAction(action);
  };
}
