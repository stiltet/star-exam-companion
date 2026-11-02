# Glossary — Professional Agentic Architect

One term per row. **Guide** is the exam-guide section; "—" means the exam guide does not name the
term in a section but lists it among the tools in scope. **Source** is where the meaning comes from;
each is an official Google page, linked in its row:

- **EG** — Google's [exam guide](https://services.google.com/fh/files/misc/professional_agentic_architect_exam_guide_english.pdf)
- **Google page** — any other official Google page, linked in its own row.

Meanings are short summaries in this repo's own words, checked against the page the row cites. Where
Google renames a product, both names get a row that points to the other, as the Generative AI Leader
pack's glossary explains. Learn the exam guide's name for each.

Names last checked: 2026-11-02

## Section 1 — Building agents using low-code tools

| Term | Meaning | Guide | Source |
|---|---|---|---|
| Workflow Builder | An interactive no-code, low-code platform for creating, managing and turning on chat agents and workflows in the Gemini Enterprise web app. | 1.1 | [Google page](https://docs.cloud.google.com/gemini/enterprise/docs/workflow-builder) |

## Section 2 — Using coding agents for application development

| Term | Meaning | Guide | Source |
|---|---|---|---|
| Agents CLI | A command-line tool and skills package for building, evaluating and deploying AI agents on Google Cloud. | 2.2 | EG, [Google page](https://google.github.io/agents-cli/guide/getting-started/) |

## Section 3 — Developing custom agents

| Term | Meaning | Guide | Source |
|---|---|---|---|
| Agent Development Kit (ADK) | An open-source, model-agnostic framework for building, debugging and deploying agents in code. It offers template workflows such as sequential, loop and parallel. | 3.1 | EG, [Google page](https://adk.dev/) |
| Skill Registry | A secure, private repository on Agent Platform that stores skills as self-contained packages. | — | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/skill-registry) |
| Agent Platform Memory Bank | Generates long-term memories dynamically from conversations between a user and an agent, so the agent can recall them in later sessions. Formerly called Vertex AI Agent Engine Memory Bank. **Renamed:** Vertex AI Agent Engine Memory Bank => Agent Platform Memory Bank. **Exam guide:** Agent Platform Memory Bank. | 3.1 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/release-notes) |
| Vertex AI Agent Engine Memory Bank | Now called Agent Platform Memory Bank. **Renamed:** Vertex AI Agent Engine Memory Bank => Agent Platform Memory Bank. **Exam guide:** Agent Platform Memory Bank. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/release-notes) |
| Agent Platform Sessions | Stores the individual interactions between users and agents, so a conversation keeps its history. Memory Bank draws its long-term memories from stored sessions. | 3.1 | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/sessions) |
| Vector Search | Google's vector search engine, an AI-native engine for storing, searching and managing data for AI applications. | 3.2 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/overview) |
| RAG Engine | A component of Agent Platform that facilitates retrieval-augmented generation: it connects private enterprise data to LLMs to improve answer accuracy and reduce hallucinations. | 3.2 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/rag-overview) |
| Model Garden | A catalogue of Google's frontier models such as Gemini, plus third-party and open-source models. | — | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/overview) |
| Agent Runtime | A high-performance, scalable runtime environment for deploying, operating and scaling agents. Formerly called Agent Engine. **Renamed:** Agent Engine => Agent Runtime. **Exam guide:** Agent Runtime. | 3.3, 4.2 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/release-notes) |
| Agent Engine | Now called Agent Runtime. **Renamed:** Agent Engine => Agent Runtime. **Exam guide:** Agent Runtime. | — | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/release-notes) |

## Section 4 — Evaluating and deploying agentic workflows

| Term | Meaning | Guide | Source |
|---|---|---|---|
| Agent evaluation | Systematically assessing agent quality, with tools such as multi-turn autoraters and online evaluation of live traffic. | 4.1 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/optimize/evaluation/agent-evaluation) |

## Section 5 — Securing and governing agentic workflows

| Term | Meaning | Guide | Source |
|---|---|---|---|
| Agent Identity | Gives each agent a fully managed, unique identity, so access to resources can be controlled and audited per agent. | 5.1 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/overview) |
| Agent Gateway | The governance and security enforcement layer for agents: a central policy enforcement point for agent tool calls, authentication and security policies. It is the networking component of Agent Platform. | 5.1 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/govern/gateways/agent-gateway-overview) |
| Client-to-Agent | An Agent Gateway mode for inbound traffic: it secures communications between clients and the agents or MCP tools they reach. | 5.1 | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/govern/gateways/agent-gateway-overview) |
| Agent-to-Anywhere | An Agent Gateway mode for outbound traffic: it governs requests that agents send to external tools and services. | 5.1 | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/govern/gateways/agent-gateway-overview) |
| Agent Registry | A centralized catalog for discovering, tracking and managing agents, tools and MCP servers across the organization. | 5.1 | EG, [Google page](https://docs.cloud.google.com/agent-registry/overview) |
| Model Armor | A Google Cloud service that screens prompts and model responses for harmful content, prompt injection and jailbreaks, sensitive data and malicious links. | 5.1 | EG, [Google page](https://docs.cloud.google.com/model-armor/overview) |
