# Jira AI CLI

An AI-friendly TypeScript CLI for Jira that prioritizes efficiency and security.

## Core Benefits

1.  **Context Efficiency:** Eliminates redundant context data, consuming significantly fewer tokens than Jira MCP or similar tools.
2.  **Bullet-proof Security:** Restrict AI to only the actions you permit, ensuring your environment remains secure. 


## Installation

```bash
npm install -g jira-ai
```

## Quick Start

See all available commands:
```bash
jira-ai --help
```

## Configuration & Restrictions

Jira AI uses a `settings.yaml` file to define permissions. To find its location on your system:

```bash
jira-ai about
```

To configure allowed projects and commands, follow the instructions in [EDITSETTINGS.md](./EDITSETTINGS.md).


## Links

- **Repository:** [https://github.com/festoinc/jira-ai](https://github.com/festoinc/jira-ai)
- **Issues:** [https://github.com/festoinc/jira-ai/issues](https://github.com/festoinc/jira-ai/issues)

## License

Apache License 2.0