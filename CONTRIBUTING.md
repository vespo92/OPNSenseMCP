# Contributing to OPNSense MCP Server

We love your input! We want to make contributing to this project as easy and transparent as possible.

## Development Process

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. Ensure the test suite passes
4. Make sure your code follows the existing style
5. Issue that pull request!

## Code Style

- Use TypeScript for all new code
- Follow the existing patterns in the codebase
- Add JSDoc comments for public APIs
- Keep files focused and modular

## Project Structure

```
src/
├── api/          # OPNsense API client
├── resources/    # Resource implementations
├── iac/          # Infrastructure as Code base
├── state/        # State management
├── deployment/   # Deployment planning
└── execution/    # Execution engine
```

## Adding New Resources

1. Create a new resource class extending `IaCResource`
2. Implement required methods:
   - `validate()`
   - `toApiPayload()`
   - `fromApiResponse()`
3. Register the resource in `resources/registry.ts`
4. Add tests for the new resource

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Commit Messages

- Use clear, descriptive commit messages
- Start with a verb (Add, Fix, Update, etc.)
- Reference issues when applicable

## Reporting Bugs

Report bugs using GitHub Issues. Include:
- A quick summary and/or background
- Steps to reproduce
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening)

## Feature Requests

We'd love to hear your ideas! Open an issue with:
- Clear description of the feature
- Use cases
- Potential implementation approach

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
