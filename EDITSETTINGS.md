# How to edit Jira AI Settings

The `settings.yaml` file controls which projects and commands the Jira AI CLI is allowed to interact with. This is crucial for maintaining security when using AI agents.

## Location
You can find the location of your `settings.yaml` file by running:
```bash
jira-ai about
```

## Configuration

### Projects
Specify which project keys the tool can access. Use `all` to grant access to all projects.

```yaml
projects:
  - BP
  - PROJ
```

### Commands
Specify which commands are enabled. It is recommended to keep "write" operations (like `create-task`, `add-comment`, `update-description`) disabled unless explicitly needed.

```yaml
commands:
  - me
  - projects
  - task-with-details
  - list-issue-types
  - run-jql
  # - update-description
  # - add-comment
  # - create-task
```

To allow all commands:
```yaml
commands:
  - all
```
