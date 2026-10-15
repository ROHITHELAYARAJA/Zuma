---
name: n8n-automation
description: Use Rohith's connected n8n instance to create, inspect, test, and maintain cross-app workflows for Rohith OS.
---

# n8n automation

Use the `rohith-n8n` MCP server when available. Check authentication and permissions before claiming n8n is connected. Discover existing workflows first and avoid creating duplicates. Keep the already scheduled Rohith OS briefings in mind so a new n8n schedule does not send a second copy of the same report.

For a new automation, define its trigger, inputs, action, owner, error path, and success evidence. Build the smallest complete workflow. Use existing n8n credentials; if an app credential is missing, leave the workflow in a reviewable draft and identify the exact credential the user must connect through n8n's sign-in flow. Never put API keys, passwords, or tokens into a workflow description, node parameter, plugin file, or chat message.

Test with representative data and inspect the execution result before activating a workflow. Keep outbound email, CRM writes, publishing, purchases, and destructive actions within the user's specific authorization. Report the workflow link, trigger, test outcome, and activation state after any change.
