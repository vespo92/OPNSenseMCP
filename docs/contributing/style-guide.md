# Documentation Style Guide

## 📝 Writing Principles

### Voice and Tone
- **Clear and Direct**: Use simple, straightforward language
- **User-Focused**: Write from the user's perspective
- **Action-Oriented**: Start with verbs for instructions
- **Professional but Friendly**: Be helpful without being overly casual

### Audience Assumptions
- Technical users comfortable with command line
- Familiar with basic networking concepts
- May be new to OPNsense or MCP
- Using Claude Desktop or similar AI tools

## 📐 Document Structure

### Standard Document Template

```markdown
# Document Title

Brief one-sentence description of what this document covers.

## Prerequisites (if applicable)
- Required software
- Required knowledge
- Required access

## Overview (optional for short docs)
2-3 sentences explaining the topic in more detail.

## Main Content
Organized with clear headings and subheadings.

## Examples
Practical, working examples.

## Troubleshooting (if applicable)
Common issues and solutions.

## Next Steps
Where to go from here.

## Related Documentation
- [Link to related doc](path)
- [Another related doc](path)
```

### File Naming Conventions
- Use lowercase with hyphens: `dns-blocking.md`
- Be descriptive but concise: `quickstart.md` not `getting-started-quickly-with-opnsense-mcp.md`
- Use standard names: `README.md`, `installation.md`, `configuration.md`

## 🎨 Formatting Standards

### Headings
- **H1 (#)**: Document title only (one per document)
- **H2 (##)**: Major sections
- **H3 (###)**: Subsections
- **H4 (####)**: Rarely used, only for deep nesting
- Add emoji to H2 headers sparingly (only for main sections)

### Code Blocks
Always specify language for syntax highlighting:

````markdown
```bash
npm install
```

```javascript
const config = {
  host: "192.168.1.1"
};
```

```json
{
  "type": "opnsense:network:vlan",
  "properties": {}
}
```
````

### Commands
- Single commands: inline code `npm install`
- Command sequences: code blocks
- Always show both command and expected output when helpful

### Lists
- Use `-` for unordered lists (not `*` or `+`)
- Use `1.` for ordered lists (auto-numbering)
- Keep list items parallel in structure
- End list items with periods only if they're complete sentences

### Tables
Use tables for structured comparison:
```markdown
| Feature | Basic | Advanced |
|---------|-------|----------|
| VLANs   | ✅    | ✅       |
| IaC     | ❌    | ✅       |
```

### Links
- Relative links for internal docs: `[Installation](../getting-started/installation.md)`
- Full URLs for external: `[MCP Protocol](https://modelcontextprotocol.io)`
- Always use descriptive link text, never "click here"

## 💭 Content Guidelines

### Examples
- **Make them real**: Use realistic scenarios
- **Make them complete**: Include all necessary context
- **Make them work**: Test every example
- **Progress in complexity**: Start simple, build up

#### Good Example
```javascript
// Create a guest network isolated from your main LAN
const guestNetwork = {
  type: "opnsense:network:vlan",
  id: "guest-vlan",
  properties: {
    interface: "igc3",
    tag: 50,
    description: "Guest WiFi Network"
  }
};
```

#### Bad Example
```javascript
// Create VLAN
const v = {
  type: "vlan",
  props: { /* ... */ }
};
```

### Instructions
1. Number steps when order matters
2. Use bullets when order doesn't matter
3. Include expected outcomes
4. Mention common gotchas

#### Good Instruction
```markdown
1. Create your API credentials in OPNsense:
   - Navigate to System > Access > Users
   - Click the + button to add a new user
   - Enable "Generate a scrambled password"
   - Save and copy the key and secret

   You should now see your new API user in the list.
```

### Warnings and Notes

Use GitHub-flavored markdown alerts:

```markdown
> [!NOTE]
> Useful information that users should know.

> [!TIP]
> Optional helpful advice.

> [!IMPORTANT]
> Essential information users must know.

> [!WARNING]
> Critical information about risks or destructive actions.

> [!CAUTION]
> Extreme caution required, potential for data loss.
```

### API Documentation
- List all parameters with types
- Mark required vs optional clearly
- Include at least one example
- Document return values

```markdown
### `createVlan(properties)`

Creates a new VLAN interface.

**Parameters:**
- `interface` (string, required): Physical interface name
- `tag` (number, required): VLAN tag (1-4094)
- `description` (string, optional): VLAN description

**Returns:** `VlanResource` object

**Example:**
```javascript
const vlan = await createVlan({
  interface: "igc3",
  tag: 100,
  description: "IoT Network"
});
```
```

## 🚫 What to Avoid

### Language to Avoid
- ❌ "Simply" or "just" (can be condescending)
- ❌ "Obviously" or "clearly" (assumes too much)
- ❌ Jargon without explanation
- ❌ Ambiguous pronouns ("it", "this" without clear reference)
- ❌ Passive voice when active is clearer

### Common Mistakes
- ❌ Untested code examples
- ❌ Missing error handling in examples
- ❌ Assuming specific setup without stating it
- ❌ Mixing setup instructions with usage
- ❌ Links to non-existent pages

## ✅ Documentation Checklist

Before committing documentation:

- [ ] Spell check and grammar check
- [ ] All links tested and working
- [ ] Code examples are tested
- [ ] Formatting is consistent
- [ ] Headers have proper hierarchy
- [ ] File follows naming convention
- [ ] Related docs are cross-linked
- [ ] Technical accuracy verified

## 📚 Documentation Types

### Getting Started Guides
- Focus on immediate success
- Minimize prerequisites
- One clear path forward
- Link to advanced topics

### Feature Guides
- Start with use cases
- Explain the why before the how
- Include complete examples
- Cover common scenarios

### API Reference
- Complete parameter documentation
- Type information
- Return values
- Error conditions
- Multiple examples

### Troubleshooting
- Problem-Solution format
- Most common issues first
- Include error messages verbatim
- Provide diagnostic steps

### Architecture/Conceptual
- Start with high-level overview
- Use diagrams where helpful
- Explain design decisions
- Link to implementation details

## 🔄 Maintenance

### Regular Updates
- Review quarterly for accuracy
- Update examples with new features
- Remove deprecated content
- Fix broken links

### Version Documentation
- Tag documentation with version when relevant
- Note breaking changes prominently
- Keep upgrade guides updated

## 📏 Examples of Good vs Bad

### Good Documentation Title
✅ "Configuring DNS Blocking"
- Clear, specific, action-oriented

### Bad Documentation Title
❌ "DNS Stuff"
- Vague, informal, not helpful

### Good Opening
✅ "This guide shows you how to block unwanted websites using DNS filtering in OPNsense."
- Clear outcome, specific feature

### Bad Opening
❌ "This document contains information about DNS."
- Too vague, no clear value

### Good Example Introduction
✅ "The following example creates a guest network that has internet access but cannot reach your main LAN:"

### Bad Example Introduction
❌ "Here's some code:"

## 🎯 Quick Reference

### Markdown Elements Priority
1. **Bold** for UI elements: Click **Save**
2. *Italic* for emphasis: *optional* parameter
3. `Code` for files, commands, values: Edit `config.json`
4. > Blockquote for output or quotes

### Standard Sections Order
1. Title
2. Description
3. Prerequisites
4. Installation/Setup
5. Configuration
6. Usage
7. Examples
8. Troubleshooting
9. API Reference
10. Related Documentation

---

*This style guide is a living document. Update it as documentation patterns emerge.*