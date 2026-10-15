# CI-Workflow (noch nicht aktiv)

Der GitHub-Token, mit dem gepusht wurde, hatte keine `workflow`-Berechtigung.
Aktivieren (mit eigenen Credentials):

    git mv ci/github-actions-ci.yml .github/workflows/ci.yml
    git commit -m "ci: enable GitHub Actions workflow"
    git push
