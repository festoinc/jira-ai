# Jira AI CLI

An AI-friendly CLI for Jira that prioritizes efficiency and security.

<img width="519" height="245" alt="Screenshot From 2026-01-17 23-14-31" src="https://github.com/user-attachments/assets/97a597d8-fd5e-4cb1-a8d0-1a045b44146f" />


## Core Benefits

1.  **Context Efficiency:** Eliminates redundant context data, consuming significantly fewer tokens than Jira MCP or similar tools.
2.  **Bullet-proof Security:** Restrict AI to only the actions you permit, ensuring your environment remains secure. 


## Installation

You can share [this url](https://raw.githubusercontent.com/festoinc/jira-ai/refs/heads/main/AI-installation-guide.md) with any AI and ask to run installation with you. It will help you to do complete setup and run examples.

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
- **NPM:** [https://www.npmjs.com/package/jira-ai](https://www.npmjs.com/package/jira-ai)

## License

Apache License 2.0
