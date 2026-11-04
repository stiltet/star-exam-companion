# Glossary — Professional Agentic Architect

One term per row. **Guide** is the exam-guide section; "—" means the exam guide does not name the
term in a section but lists it among the tools in scope. **Source** is where the meaning comes from;
each is an official Google page, linked in its row:

- **EG** — Google's [exam guide](https://services.google.com/fh/files/misc/professional_agentic_architect_exam_guide_english.pdf)
- **Google page** — any other official Google page, linked in its own row.

Meanings are short summaries in this repo's own words, checked against the page the row cites. Where
Google renames a product, both names get a row that points to the other, as the Generative AI Leader
pack's glossary explains. Learn the exam guide's name for each.

Names last checked: 2026-11-04

## Section 1 — Building agents using low-code tools

| Term | Meaning | Guide | Source |
|---|---|---|---|
| Workflow Builder | An interactive no-code, low-code platform for creating, managing and turning on chat agents and workflows in the Gemini Enterprise web app. | 1.1 | [Google page](https://docs.cloud.google.com/gemini/enterprise/docs/workflow-builder) |
| Gemini Enterprise Agent Designer | A Gemini Enterprise tool for creating and sharing agents with little or no code. | 1.1 | EG, [Google page](https://codelabs.developers.google.com/next26/dev-keynote/gemini-enterprise) |
| Customer Experience Agent Studio (CX Agent Studio) | A low-code platform for building, evaluating and deploying multimodal conversational agents for customer experiences. | 1.1 | EG, [Google page](https://cloud.google.com/gemini-enterprise-cx/cx-agent-studio) |
| Agent Search | Lets developers use Google's foundation models and its search and recommendation expertise to build search and question-answering applications. Formerly called Vertex AI Search. **Renamed:** Vertex AI Search => Agent Search. **Exam guide:** Agent Search. | 1.2 | EG, [Google page](https://docs.cloud.google.com/generative-ai-app-builder/docs) |
| Vertex AI Search | Now called Agent Search. **Renamed:** Vertex AI Search => Agent Search. **Exam guide:** Agent Search. | — | [Google page](https://docs.cloud.google.com/generative-ai-app-builder/docs) |
| Gemini Enterprise | Google's enterprise offering in which Gemini answers questions, handles knowledge work, and writes and runs code in a single agent. | 1.1, 1.2 | EG, [Google page](https://cloud.google.com/gemini-enterprise) |

## Section 2 — Using coding agents for application development

| Term | Meaning | Guide | Source |
|---|---|---|---|
| Agents CLI | A command-line tool and skills package for building, evaluating and deploying AI agents on Google Cloud. | 2.2 | EG, [Google page](https://google.github.io/agents-cli/guide/getting-started/) |
| Antigravity | Google's agent-first platform for coding agents. It orchestrates subagents across environments and comes as an App, a CLI and an SDK. | 2.1, 2.2 | EG, [Google page](https://antigravity.google/product) |
| Claude Code | Anthropic's coding-agent harness, which can run Claude models on Google Cloud for tasks such as planning, coding and testing. | 2.1 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/partner-models/claude/fable-5) |
| Cloud Workstations | Managed, configurable development environments on Google Cloud, accessible through a browser, local editors or SSH. | 2.1 | EG, [Google page](https://docs.cloud.google.com/workstations/docs/overview) |

## Section 3 — Developing custom agents

| Term | Meaning | Guide | Source |
|---|---|---|---|
| Agent Development Kit (ADK) | An open-source, model-agnostic framework for building, debugging and deploying agents in code. It offers template workflows such as sequential, loop and parallel. | 3.1 | EG, [Google page](https://adk.dev/) |
| Skill Registry | A secure, private repository on Agent Platform that stores skills as self-contained packages. | — | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/skill-registry) |
| Agent Platform Memory Bank | Generates long-term memories dynamically from conversations between a user and an agent, so the agent can recall them in later sessions. Formerly called Vertex AI Agent Engine Memory Bank. **Renamed:** Vertex AI Agent Engine Memory Bank => Agent Platform Memory Bank. **Exam guide:** Agent Platform Memory Bank. | 3.1 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/release-notes) |
| Vertex AI Agent Engine Memory Bank | Now called Agent Platform Memory Bank. **Renamed:** Vertex AI Agent Engine Memory Bank => Agent Platform Memory Bank. **Exam guide:** Agent Platform Memory Bank. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/release-notes) |
| Agent Platform Sessions | Stores the individual interactions between users and agents, so a conversation keeps its history. Memory Bank draws its long-term memories from stored sessions. | 3.1 | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/sessions) |
| Vector Search | Google's vector search engine, an AI-native engine for storing, searching and managing data for AI applications. | 3.2 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/overview) |
| Vector Search 1.0 | The original index-based Vector Search service, from which data can be migrated to Agent Retrieval collections. | 3.2 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/vector-search-2/migration-from-vs-1_0) |
| RAG Engine | A component of Agent Platform that facilitates retrieval-augmented generation: it connects private enterprise data to LLMs to improve answer accuracy and reduce hallucinations. | 3.2 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/rag-overview) |
| Model Garden | A catalogue of Google's frontier models such as Gemini, plus third-party and open-source models. | — | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/overview) |
| Agent Runtime | A high-performance, scalable runtime environment for deploying, operating and scaling agents. Formerly called Agent Engine. **Renamed:** Agent Engine => Agent Runtime. **Exam guide:** Agent Runtime. | 3.3, 4.2 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/release-notes) |
| Agent Engine | Now called Agent Runtime. **Renamed:** Agent Engine => Agent Runtime. **Exam guide:** Agent Runtime. | — | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/release-notes) |
| Gemini LLMs | Google's Gemini models, which handle complex coding and multimodal reasoning. | — | EG, [Google page](https://ai.google.dev/gemini-api/docs) |
| Model Context Protocol (MCP) | An open-source standard for connecting AI applications to external systems such as data sources, tools and workflows. | 2.1, 3.3 | EG, [Google page](https://modelcontextprotocol.io/docs/getting-started/intro) |
| MCP servers | Programs that expose a service's capabilities, such as APIs or databases, to AI applications through MCP; they can run locally or remotely. | 2.1, 3.2 | EG, [Google page](https://docs.cloud.google.com/mcp/overview) |
| Google Cloud MCP Servers | Remote servers that expose Google Cloud service capabilities to AI applications through MCP, with access controlled by Google Cloud. | 3.2 | EG, [Google page](https://docs.cloud.google.com/mcp/overview) |
| Agent2Agent (A2A) | An open standard that lets different AI agents securely communicate, collaborate and solve problems together. | 3.3 | EG, [Google page](https://a2a-protocol.org/latest/) |
| Agent Retrieval | A fully managed, AI-native search engine that evolves Vector Search into storage and retrieval: you work with Collections of Data Objects instead of indexes. Formerly called Vector Search 2.0. **Renamed:** Vector Search 2.0 => Agent Retrieval. **Exam guide:** Agent Retrieval. | 3.2 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/vector-search-2/overview) |
| Vector Search 2.0 | Now called Agent Retrieval. **Renamed:** Vector Search 2.0 => Agent Retrieval. **Exam guide:** Agent Retrieval. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/vector-search-2/overview) |
| BigQuery | A fully managed, AI-ready data platform for managing and analysing data, with a serverless architecture that uses SQL and Python. | — | EG, [Google page](https://cloud.google.com/bigquery/docs/introduction) |
| Cloud SQL | A fully managed relational database service for MySQL, PostgreSQL and SQL Server. | — | EG, [Google page](https://cloud.google.com/sql/docs/introduction) |
| Cloud Storage | A scalable, managed object storage service for storing and retrieving any amount of data at any time. | — | EG, [Google page](https://cloud.google.com/storage/docs/introduction) |
| Firestore | A fully managed, scalable, serverless document database. | — | EG, [Google page](https://cloud.google.com/firestore/docs/overview) |
| Memorystore for Redis | A fully managed service powered by the Redis in-memory data store, for application caches with sub-millisecond data access. | — | EG, [Google page](https://cloud.google.com/memorystore/docs/redis/memorystore-for-redis-overview) |

## Section 4 — Evaluating and deploying agentic workflows

| Term | Meaning | Guide | Source |
|---|---|---|---|
| Agent evaluation | Systematically assessing agent quality, with tools such as multi-turn autoraters and online evaluation of live traffic. | 4.1 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/optimize/evaluation/agent-evaluation) |
| ADK evaluation tooling (evalset) | ADK's evaluation tools compare agent responses and tool-use trajectories with reference cases; an evalset can contain multiple sessions. | 4.1 | EG, [Google page](https://adk.dev/evaluate/) |
| Agent Platform Gen AI evaluation service | A managed evaluation service for generative AI models and agents, using methods such as adaptive rubrics and computation-based metrics. | 4.1 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/evaluation-overview) |
| Cloud Run | A fully managed application platform for running your code, function or container on Google's scalable infrastructure. | 4.2 | EG, [Google page](https://cloud.google.com/run/docs/overview/what-is-cloud-run) |
| Google Kubernetes Engine (GKE) | A managed Kubernetes service for deploying containerised applications on Google Cloud. | 2.1, 4.2 | EG, [Google page](https://cloud.google.com/kubernetes-engine/docs/concepts/kubernetes-engine-overview) |
| Google Cloud Observability | Google's integrated monitoring, logging and tracing services for applications and systems; the guide names Cloud Logging and Cloud Trace. | 4.2 | EG, [Google page](https://cloud.google.com/products/observability) |
| Cloud Logging | A real-time log-management system with storage, search, analysis and monitoring support. It collects log data from Google Cloud resources automatically. | 4.2 | EG, [Google page](https://cloud.google.com/logging/docs/overview) |
| Cloud Trace | A distributed tracing system that tracks request latency and helps troubleshoot performance bottlenecks across services and generative AI applications. | 4.2 | EG, [Google page](https://cloud.google.com/trace/docs/overview) |

## Section 5 — Securing and governing agentic workflows

| Term | Meaning | Guide | Source |
|---|---|---|---|
| Agent Identity | Gives each agent a fully managed, unique identity, so access to resources can be controlled and audited per agent. | 5.1 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/overview) |
| Agent Gateway | The governance and security enforcement layer for agents: a central policy enforcement point for agent tool calls, authentication and security policies. It is the networking component of Agent Platform. | 5.1 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/govern/gateways/agent-gateway-overview) |
| Client-to-Agent | An Agent Gateway mode for inbound traffic: it secures communications between clients and the agents or MCP tools they reach. | 5.1 | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/govern/gateways/agent-gateway-overview) |
| Agent-to-Anywhere | An Agent Gateway mode for outbound traffic: it governs requests that agents send to external tools and services. | 5.1 | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/govern/gateways/agent-gateway-overview) |
| Agent Registry | A centralized catalog for discovering, tracking and managing agents, tools and MCP servers across the organization. | 5.1 | EG, [Google page](https://docs.cloud.google.com/agent-registry/overview) |
| Model Armor | A Google Cloud service that screens prompts and model responses for harmful content, prompt injection and jailbreaks, sensitive data and malicious links. | 5.1 | EG, [Google page](https://docs.cloud.google.com/model-armor/overview) |
| Auth Manager | A centralised credentials vault and authentication broker that simplifies an agent's outbound tool authentication, covering 3-legged OAuth, 2-legged OAuth and API keys. | 5.1 | EG, [Google page](https://docs.cloud.google.com/iam/docs/auth-manager-overview) |
| OAuth 2.0 | An authorisation protocol that lets an application obtain scoped access tokens for APIs, including access granted with user consent. | 5.1 | EG, [Google page](https://developers.google.com/identity/protocols/oauth2) |
| Sensitive Data Protection | Helps you discover, classify and de-identify sensitive data inside and outside Google Cloud. | — | EG, [Google page](https://cloud.google.com/sensitive-data-protection/docs/sensitive-data-protection-overview) |
