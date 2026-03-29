from conftest import run_cli


class TestNoMultiOrgArtifacts:
    def test_no_org_command_in_top_level_help(self):
        result = run_cli("--help")
        assert result.returncode == 0
        lines = result.stdout.split("\n")
        for line in lines:
            low = line.lower().strip()
            assert not low.startswith("org"), f"Found 'org' command in help: {line}"

    def test_no_organization_flag_in_global_options(self):
        result = run_cli("--help")
        assert result.returncode == 0
        assert "-o" not in result.stdout.split("organization")[0] if "organization" in result.stdout else True
        assert "--organization" not in result.stdout, "--organization flag should not exist"

    def test_no_org_command_group(self):
        result = run_cli("--help")
        assert result.returncode == 0
        commands = []
        for line in result.stdout.split("\n"):
            stripped = line.strip()
            if stripped and not stripped.startswith("Usage") and not stripped.startswith("Options") and not stripped.startswith("CLI") and not stripped.startswith("-"):
                parts = stripped.split()
                if parts:
                    commands.append(parts[0].split("|")[0])

        assert "org" not in commands, "'org' command group should not exist"
        assert "organization" not in commands, "'organization' command group should not exist"

    def test_no_alias_flag_in_auth(self):
        result = run_cli("auth", "--help")
        assert result.returncode == 0
        assert "--alias" not in result.stdout, "--alias flag should not exist in auth"

    def test_no_org_subcommand_in_auth(self):
        result = run_cli("auth", "--help")
        assert result.returncode == 0
        assert "org" not in result.stdout.lower() or "organization" not in result.stdout.lower().replace("atlassian", ""), \
            "auth should not reference org subcommand"

    def test_no_organization_option_in_issue_commands(self):
        for subcmd in ["get", "create", "search", "transition", "comment", "stats", "assign"]:
            result = run_cli("issue", subcmd, "--help")
            if result.returncode == 0:
                assert "-o" not in [line.strip().split()[0] for line in result.stdout.split("\n")
                                    if line.strip().startswith("-o") and "organization" in line.lower()], \
                    f"issue {subcmd} should not have -o/--organization flag"
                assert "--organization" not in result.stdout, \
                    f"issue {subcmd} should not have --organization flag"

    def test_no_organization_option_in_project_commands(self):
        for subcmd in ["list", "statuses", "types"]:
            result = run_cli("project", subcmd, "--help")
            if result.returncode == 0:
                assert "--organization" not in result.stdout, \
                    f"project {subcmd} should not have --organization flag"

    def test_no_organization_option_in_user_commands(self):
        for subcmd in ["me", "search", "worklog"]:
            result = run_cli("user", subcmd, "--help")
            if result.returncode == 0:
                assert "--organization" not in result.stdout, \
                    f"user {subcmd} should not have --organization flag"

    def test_no_organization_option_in_confl_commands(self):
        for subcmd in ["get", "spaces", "pages", "search", "create"]:
            result = run_cli("confl", subcmd, "--help")
            if result.returncode == 0:
                assert "--organization" not in result.stdout, \
                    f"confl {subcmd} should not have --organization flag"

    def test_no_org_in_settings_help(self):
        result = run_cli("settings", "--help")
        assert result.returncode == 0
        assert "--organization" not in result.stdout
        assert "org" not in [line.strip().split()[0] for line in result.stdout.split("\n")
                             if line.strip().lower().startswith("org")]
