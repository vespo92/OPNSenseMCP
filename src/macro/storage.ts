import { promises as fs } from 'fs';
import path from 'path';
import { MacroRecording, IMacroStorage } from './types.js';

export class MacroStorage implements IMacroStorage {
  private storagePath: string;
  
  constructor(storagePath?: string) {
    this.storagePath = storagePath || path.join(process.cwd(), '.opnsense-macros');
  }
  
  async ensureStorageExists(): Promise<void> {
    try {
      await fs.access(this.storagePath);
    } catch {
      await fs.mkdir(this.storagePath, { recursive: true });
    }
  }
  
  async save(macro: MacroRecording): Promise<void> {
    await this.ensureStorageExists();
    
    const filePath = path.join(this.storagePath, `${macro.id}.json`);
    const data = JSON.stringify(macro, null, 2);
    
    await fs.writeFile(filePath, data, 'utf8');
    
    // Also update the index
    await this.updateIndex(macro);
  }
  
  async load(id: string): Promise<MacroRecording | null> {
    try {
      const filePath = path.join(this.storagePath, `${id}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      const macro = JSON.parse(data);
      
      // Convert date strings back to Date objects
      macro.created = new Date(macro.created);
      macro.updated = new Date(macro.updated);
      
      return macro;
    } catch {
      return null;
    }
  }
  
  async list(): Promise<MacroRecording[]> {
    await this.ensureStorageExists();
    
    try {
      const indexPath = path.join(this.storagePath, 'index.json');
      const data = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(data);
      
      // Load each macro
      const macros: MacroRecording[] = [];
      for (const entry of index.macros) {
        const macro = await this.load(entry.id);
        if (macro) {
          macros.push(macro);
        }
      }
      
      return macros;
    } catch {
      // No index or error reading it - scan directory
      return await this.scanDirectory();
    }
  }
  
  async delete(id: string): Promise<void> {
    const filePath = path.join(this.storagePath, `${id}.json`);
    
    try {
      await fs.unlink(filePath);
      await this.removeFromIndex(id);
    } catch {
      // File doesn't exist or can't be deleted
    }
  }
  
  async search(query: {
    name?: string;
    tags?: string[];
    category?: string;
  }): Promise<MacroRecording[]> {
    const allMacros = await this.list();
    
    return allMacros.filter(macro => {
      if (query.name && !macro.name.toLowerCase().includes(query.name.toLowerCase())) {
        return false;
      }
      
      if (query.category && macro.metadata.category !== query.category) {
        return false;
      }
      
      if (query.tags && query.tags.length > 0) {
        const macroTags = macro.metadata.tags || [];
        const hasAllTags = query.tags.every(tag => macroTags.includes(tag));
        if (!hasAllTags) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  // Helper methods
  
  private async updateIndex(macro: MacroRecording): Promise<void> {
    const indexPath = path.join(this.storagePath, 'index.json');
    let index: any;
    
    try {
      const data = await fs.readFile(indexPath, 'utf8');
      index = JSON.parse(data);
    } catch {
      index = { macros: [] };
    }
    
    // Remove existing entry if any
    index.macros = index.macros.filter((m: any) => m.id !== macro.id);
    
    // Add new entry
    index.macros.push({
      id: macro.id,
      name: macro.name,
      description: macro.description,
      created: macro.created,
      updated: macro.updated,
      category: macro.metadata.category,
      tags: macro.metadata.tags || []
    });
    
    // Sort by updated date
    index.macros.sort((a: any, b: any) => 
      new Date(b.updated).getTime() - new Date(a.updated).getTime()
    );
    
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
  }
  
  private async removeFromIndex(id: string): Promise<void> {
    const indexPath = path.join(this.storagePath, 'index.json');
    
    try {
      const data = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(data);
      
      index.macros = index.macros.filter((m: any) => m.id !== id);
      
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
    } catch {
      // No index to update
    }
  }
  
  private async scanDirectory(): Promise<MacroRecording[]> {
    await this.ensureStorageExists();
    
    const files = await fs.readdir(this.storagePath);
    const macros: MacroRecording[] = [];
    
    for (const file of files) {
      if (file.endsWith('.json') && file !== 'index.json') {
        const id = file.replace('.json', '');
        const macro = await this.load(id);
        if (macro) {
          macros.push(macro);
        }
      }
    }
    
    // Sort by updated date
    macros.sort((a, b) => b.updated.getTime() - a.updated.getTime());
    
    return macros;
  }
  
  /**
   * Export all macros to a single file
   */
  async exportAll(exportPath: string): Promise<void> {
    const macros = await this.list();
    const exportData = {
      version: '1.0',
      exported: new Date().toISOString(),
      macros
    };
    
    await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2), 'utf8');
  }
  
  /**
   * Import macros from an export file
   */
  async importAll(importPath: string, overwrite: boolean = false): Promise<number> {
    const data = await fs.readFile(importPath, 'utf8');
    const importData = JSON.parse(data);
    
    let imported = 0;
    
    for (const macro of importData.macros) {
      // Check if macro already exists
      if (!overwrite) {
        const existing = await this.load(macro.id);
        if (existing) {
          continue;
        }
      }
      
      // Convert date strings back to Date objects
      macro.created = new Date(macro.created);
      macro.updated = new Date(macro.updated);
      
      await this.save(macro);
      imported++;
    }
    
    return imported;
  }
}