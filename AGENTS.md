# AGENTS.md

## 1. Project Overview

<!-- EDIT FOR EACH PROJECT -->

* Project name: {{PROJECT_NAME}}
* Purpose: {{PROJECT_PURPOSE}}
* Current status: {{PROJECT_STATUS}}
* Primary users: {{TARGET_USERS}}

## 2. Technology Stack

<!-- EDIT FOR EACH PROJECT -->

* Language: {{LANGUAGE_AND_VERSION}}
* Framework: {{FRAMEWORK_AND_VERSION}}
* Database: {{DATABASE}}
* Build tool: {{BUILD_TOOL}}
* Testing: {{TEST_FRAMEWORKS}}
* Main libraries: {{MAIN_LIBRARIES}}

Rules:

* Use the existing technology stack.
* Do not introduce a new framework, library, database, or build tool without explicit approval.
* Do not upgrade dependency versions unless the approved task requires it.

## 3. Project Structure

<!-- EDIT FOR EACH PROJECT -->

* `{{PATH}}`: {{RESPONSIBILITY}}
* `{{PATH}}`: {{RESPONSIBILITY}}
* `{{PATH}}`: {{RESPONSIBILITY}}

Rules:

* Follow the existing project structure.
* Place new files near related existing files whenever possible.
* Do not introduce a new top-level folder without approval.
* Do not reorganize, move, or rename existing files unless required by the approved plan.
* Do not create duplicate folders or abstractions for responsibilities already covered by the project.

## 4. Architecture

<!-- EDIT FOR EACH PROJECT -->

* Architecture style: {{ARCHITECTURE_STYLE}}
* Request flow: {{REQUEST_FLOW}}
* Dependency direction: {{DEPENDENCY_DIRECTION}}
* Mapping strategy: {{MAPPING_STRATEGY}}

Rules:

* Follow the existing architecture and coding patterns.
* Respect the existing dependency direction.
* Do not bypass established layers for convenience.
* Do not introduce a new architectural pattern without approval.
* Preserve existing public contracts unless changing them is part of the approved task.
* Do not expose persistence models directly when the project uses DTOs.
* Reuse existing services, components, utilities, and abstractions when appropriate.

## 5. Commands

<!-- EDIT FOR EACH PROJECT -->

* Install dependencies: `{{INSTALL_COMMAND}}`
* Build: `{{BUILD_COMMAND}}`
* Run tests: `{{TEST_COMMAND}}`
* Run one test: `{{SINGLE_TEST_COMMAND}}`
* Run application: `{{RUN_COMMAND}}`
* Lint or static analysis: `{{LINT_COMMAND}}`
* Type check: `{{TYPE_CHECK_COMMAND}}`
* Format check: `{{FORMAT_CHECK_COMMAND}}`

Rules:

* Prefer project wrappers and existing scripts, such as `mvnw`, `gradlew`, or scripts defined in `package.json`.
* Use commands supported by the project configuration.
* Do not invent commands when there is no evidence that they are valid.
* Do not run deployment, publishing, migration, production, or destructive commands without explicit approval.
* During PLAN-ONLY mode, do not run commands that may modify project files.
* Clearly report commands that cannot be executed.

## 6. Project-Specific Rules

<!-- EDIT FOR EACH PROJECT -->

* {{BUSINESS_RULE_OR_CONSTRAINT}}
* {{BUSINESS_RULE_OR_CONSTRAINT}}
* {{PROTECTED_FILE_OR_DIRECTORY}}
* {{IMPORTANT_TECHNICAL_DECISION}}

General rules:

* Do not invent API endpoints, DTO fields, database columns, environment variables, business rules, credentials, or configuration values.
* Treat verified source code and project documentation as the source of truth.
* When documentation and source code conflict, report the conflict instead of silently choosing one.
* Do not manually edit generated files, build output, dependency caches, or migration history unless the task explicitly requires it.
* Never expose credentials, tokens, keys, secrets, or personal data.

## 7. Default Working Mode: PLAN-ONLY

<!-- KEEP FOR ALL PROJECTS -->

Always start in `PLAN-ONLY` mode.

During PLAN-ONLY mode:

* Inspect the repository using read-only operations.
* Read relevant source code, configuration, tests, documentation, and Git changes.
* Review repository state using commands such as `git status` and `git diff`.
* Do not create, modify, delete, move, rename, or format files.
* Do not install, remove, or update dependencies.
* Do not change project configuration.
* Do not run migrations, code generators, deployment commands, or destructive commands.
* Do not treat the initial task description as permission to edit code.
* Do not treat a request to analyze, explain, review, debug, or plan as permission to implement.
* First provide an implementation plan and wait for approval.

The implementation plan must include:

1. Understanding of the task.
2. Current behavior.
3. Relevant files, classes, modules, or components.
4. Proposed implementation steps.
5. Files expected to change.
6. Risks and assumptions.
7. Verification and testing strategy.

For trivial tasks, the plan may be concise, but modifying files still requires approval.

Only edit files after the user explicitly says:

`APPROVED: IMPLEMENT THE PLAN`

Approval rules:

* Approval applies only to the latest plan shown in the current conversation.
* Approval permits implementation only within the scope of that plan.
* Approval does not permit Git operations, migrations, deployment, publishing, or dependency changes unless they are separately requested.
* Similar wording, implied consent, or the original task request does not count as approval.

## 8. Implementation Rules

<!-- KEEP FOR ALL PROJECTS -->

After approval:

* Modify only the approved scope.
* Preserve existing behavior unless the approved task requires otherwise.
* Prefer small, focused, and reversible changes.
* Follow existing naming, formatting, architecture, and coding conventions.
* Reuse existing abstractions and components where appropriate.
* Do not add, remove, or update dependencies without explicit approval.
* Do not refactor unrelated code.
* Do not change public APIs, database schemas, security behavior, or business rules unless included in the approved plan.
* Do not hide errors, bypass validation, or suppress warnings without justification.
* Do not weaken authentication, authorization, validation, or security controls.
* Do not overwrite, discard, or revert existing user changes.
* Do not modify generated files unless required by the approved task.

A new approval is required when implementation needs changes outside the approved:

* Files or modules.
* Architecture.
* Dependencies.
* Public API contracts.
* Database schema or migrations.
* Security behavior.
* Business behavior.
* Testing strategy.

A new approval is not required for small implementation details that remain inside the approved scope, such as:

* Adding necessary imports.
* Updating directly related tests.
* Correcting local types.
* Updating directly related documentation.
* Applying existing formatting conventions.

## 9. Testing and Verification

<!-- MOSTLY KEEP -->

* Run the smallest relevant verification first.
* Run focused tests before broader test suites.
* Run lint, static analysis, type checking, and build checks when relevant.
* Run the full test suite when appropriate and practical.
* Do not change tests merely to make failing code pass.
* Do not remove assertions, validation, or test coverage without approval.
* Distinguish pre-existing failures from failures introduced by the implementation.
* Clearly report commands that failed or could not be executed.
* Never claim success without verification evidence.
* Do not claim that the application works solely because the code compiles.
* Do not hide failed verification steps.

## 10. Git Rules

<!-- KEEP FOR ALL PROJECTS -->

* Do not create, delete, or switch branches unless requested.
* Do not commit, amend, push, pull, merge, rebase, reset, stash, tag, or cherry-pick unless requested.
* Do not stage files unless requested.
* Do not discard, overwrite, or revert existing user changes.
* Review `git status` before implementation.
* Review `git status` and `git diff` before reporting completion.
* Include only task-related changes.
* Do not include secrets, environment files, build output, IDE metadata, or unrelated generated files in Git operations.
* Treat approval to implement as separate from approval to perform Git operations.

## 11. Completion Report

<!-- KEEP FOR ALL PROJECTS -->

After implementation, report:

1. What was changed.
2. Files that were created, modified, moved, or deleted.
3. Tests and commands executed.
4. Verification results.
5. Commands that failed or could not be executed.
6. Remaining risks, assumptions, or follow-up work.
7. Changes requiring manual review.
8. Any deviation from the approved plan.

Use one of the following completion statuses:

* `VERIFIED`: all relevant verification steps passed.
* `PARTIALLY VERIFIED`: some verification steps passed, but others could not be completed.
* `NOT VERIFIED`: required verification was not completed or failed.

Do not report the task as complete when required verification has not passed.
