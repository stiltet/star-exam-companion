# Glossary — Generative AI Leader

One term per row. Terms use the exam's spelling. **Guide** is the exam-guide section; "—"
means the exam guide does not name the term but the study guide does. **Source** is where
the meaning comes from:

- **SG** — Google's [study guide](https://services.google.com/fh/files/misc/generative_ai_leader_study_guide_english.pdf), with page
- **EG** — Google's [exam guide](https://services.google.com/fh/files/misc/generative_ai_leader_exam_guide_english.pdf)
- **MLG** — Google's [ML glossary, generative AI](https://developers.google.com/machine-learning/glossary/generative)
- **IAM** — Google Cloud [IAM overview](https://docs.cloud.google.com/iam/docs/overview)
- **IAM security** — Google Cloud [Use IAM securely](https://docs.cloud.google.com/iam/docs/using-iam-securely)
- **NLP page** — Google Cloud [What is natural language processing?](https://cloud.google.com/learn/what-is-natural-language-processing)
- **Course** — Google Skills [Introduction to Image Generation](https://www.skills.google/course_templates/541)
- **Product page** — Google Cloud [Agent Platform](https://cloud.google.com/vertex-ai) and [Gemini Enterprise for Customer Experience](https://cloud.google.com/solutions/customer-engagement-ai), checked 8 Oct
- **Release notes** — Agent Platform [release notes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/release-notes), including Google's Vertex AI naming table of 22 Apr 2026
- **Google page** — any other official Google page, linked in its own row. All checked 8 Oct.

Covered on 29 Sept: the whole exam guide, intro to 4.3. Validated on 30 Sept against every
term the exam guide names; the list is [`checks/glossary-terms.txt`](checks/glossary-terms.txt).
Re-validated on 8 Oct against the exam guide, the whole study guide, the release notes and
every linked page. Re-validated again on 12 Nov, row by row, against the exam guide, the
whole study guide, the five course summaries and every linked page, fetched live in English
(each quoted phrase found on its page); four rows fixed. A date is stamped below only after
such a pass, never copied between repos.

**Renames.** Exam guides lag behind Google's renames, so both names get a row. In the table the
new name's row says "Formerly called …" and the old name's row says "Now called …".
Both rows carry the same marker, `**Renamed:** Old => New.`, so each points to the other.
Learn one name per product: the exam guide's (its `**Exam guide:**` marker), or the newest
name when the guide names neither. The quiz leads with that name in bold and shows the other
only as "also called" (exam guide first, then the newest name). Sub-products follow their parent, but not always as
"Agent Platform X": Vertex AI Studio is now Agent Studio and Vertex AI RAG Engine is now RAG
Engine. Google's full list is the naming table in the release notes.

Names last checked: 2026-11-12

## Section 1 — Fundamentals of gen AI

| Term | Meaning | Guide | Source |
|---|---|---|---|
| Artificial intelligence (AI) | Building machines that do tasks that usually need human intelligence, such as learning, problem-solving and decision-making. | 1.1 | SG p.3 |
| Machine learning (ML) | A subfield of AI where machines learn from data to perform specific tasks. | 1.1 | SG p.3 |
| Deep learning | A subset of ML that uses neural networks with many layers to find complex patterns in data. | 1.1 | SG p.3 |
| Generative AI | An application of ML that creates new content. It can create, summarise, discover and automate. | 1.1 | SG p.3 |
| Natural language processing (NLP) | Uses machine learning to reveal the structure and meaning of text, for example to pull out people, places and events or read sentiment. | 1.1 | NLP page |
| Foundation model | A very large model pre-trained on an enormous, diverse dataset and adaptable to many tasks. The basis of gen AI. | 1.1 | SG p.3, MLG |
| Multimodal foundation model | A foundation model that can process and generate different types of data, such as text, images and code, at the same time. | 1.1 | SG p.3 |
| Large language model (LLM) | A foundation model designed to understand and generate human language. | 1.1 | SG p.3 |
| Diffusion model | A family of ML models for generating images, inspired by thermodynamics. They underpin many image generation tools on Google Cloud; Imagen is one. | 1.1 | Course, SG p.4 |
| Prompt | The instruction or input you give a model to get the output you want. | 1.1 | SG p.3 |
| Prompt engineering | Writing effective prompts to get the most out of a model and tailor its answers. Changes the input, not the model. | 1.1, 3.2 | SG p.3 |
| Prompt tuning | A parameter-efficient tuning method that learns a prefix, which the system prepends to the actual prompt. Most versions add it only at the input layer. | 1.1 | MLG |
| Context window | The amount of text the model can consider. | 1.1 | SG p.9 |
| Supervised learning | Trains models on labeled data to predict outputs for new inputs. | 1.1 | SG p.3 |
| Unsupervised learning | Uses unlabeled data to find natural groupings and patterns. | 1.1 | SG p.3 |
| Reinforcement learning | Learns through interaction and feedback, maximising rewards and minimising penalties. | 1.1 | SG p.3 |
| Data ingestion and preparation | ML lifecycle stage: collect, clean and transform raw data into a usable format. | 1.1 | SG p.4 |
| Model training | ML lifecycle stage: create the model from data. | 1.1 | SG p.4 |
| Model deployment | ML lifecycle stage: make a trained model available for use. | 1.1 | SG p.4 |
| Model management | ML lifecycle stage: manage and maintain models over time. | 1.1 | SG p.4 |
| Gen AI use cases | What gen AI can do for a business: create, summarise, discover and automate. Exam guide examples: text, image, code and video generation, data analysis, personalised user experience. | 1.1, 4.1 | EG, SG p.3 |
| Create | A use of gen AI: generate new content. | 1.1 | SG p.3 |
| Summarize | A use of gen AI: condense information into concise summaries. | 1.1 | SG p.3 |
| Discover | A use of gen AI: find information at the right time. | 1.1 | SG p.3 |
| Automate | A use of gen AI: automate tasks that used to be manual. | 1.1 | SG p.3 |
| Modality | A model-choice factor: pick a model whose input and output data types (text, images, audio, video) match what the application needs. | 1.1 | SG p.10 |
| Performance | A model-choice factor: the model's accuracy, speed and efficiency. Weigh it against cost. | 1.1 | SG p.10 |
| Availability and reliability | A model-choice factor: the model is consistently available and performs reliably under load. Consider uptime guarantees, redundancy and disaster recovery. | 1.1 | SG p.10 |
| Security | A model-choice factor in the exam guide: how well the model and its platform protect your data and meet your security needs. Exam-guide term; the study guide does not define it. | 1.1 | EG |
| Customization | A model-choice factor: how specialised the AI needs to be. Fine-tuning is one way to customise a model. | 1.1 | SG p.10, EG |
| Cost | A model-choice factor: trade performance against cost; a bigger context window also costs more to compute. Budget is part of a project's resources. | 1.1, 1.2 | SG p.10, EG |
| Structured data | Organised and easy to search, often stored in relational databases. | 1.2 | SG p.4 |
| Unstructured data | Has no predefined structure and needs sophisticated analysis. | 1.2 | SG p.4 |
| Labeled data | Data with tags such as a name, type or number. | 1.2 | SG p.3 |
| Unlabeled data | Raw data with no tags, such as unorganised photos or audio recordings. | 1.2 | SG p.3 |
| Quality data | Accurate, complete, consistent and relevant. | 1.2 | SG p.4 |
| Accessible data | Readily available, usable and in the right format for training. | 1.2 | SG p.4 |
| Infrastructure layer | The core computing for gen AI: servers, GPUs, TPUs and the software to store and run models. | 1.3 | SG p.4 |
| Model layer | The algorithm trained on vast data that generates content, translates and answers questions. | 1.3 | SG p.4 |
| Platform layer | APIs, data management and model deployment tools. Bridges models and agents. | 1.3 | SG p.4 |
| Agent layer | Software that learns how best to reach a goal from its inputs and the tools it has. | 1.3 | SG p.4 |
| Application layer | The user-facing part of gen AI. | 1.3 | SG p.4 |
| Gemini | Google's multimodal model: understanding, conversation, content creation and question answering. | 1.4 | SG p.4 |
| Gemma | A family of lightweight open models built from the same research as Gemini. Customisable, for local deployments and specialised AI applications. | 1.4 | MLG, SG p.4 |
| Imagen | Text-to-image diffusion model: high-quality images from text descriptions. | 1.4 | SG p.4 |
| Veo | Generates video from text descriptions or still images. | 1.4 | SG p.4 |

## Section 2 — Google Cloud's gen AI offerings

Most renames live here. Each renamed product has an old-name row and a new-name row; see
**Renames** at the top.

| Term | Meaning | Guide | Source |
|---|---|---|---|
| AI-first approach | Google is an AI-first company: it keeps you up to date with the latest AI advances and puts security and ethics at the forefront. | 2.1 | SG p.5 |
| Comprehensive AI ecosystem | Gen AI tools are integrated across Google's products and services. | 2.1 | SG p.5 |
| Enterprise-ready AI platform | Google Cloud gives an enterprise-grade foundation to build on: responsible, secure, private, reliable and scalable. | 2.1 | SG p.5, EG |
| Open approach | Flexibility and choice in your AI solutions, for example Google, third-party or open-source models in Model Garden. | 2.1 | SG p.5, p.6 |
| AI Hypercomputer | Google Cloud's architecture that combines purpose-built hardware, open software and flexible consumption models. TPUs run on it. | 2.1 | [Google page](https://cloud.google.com/tpu) |
| Tensor Processing Unit (TPU) | Google's custom-designed chip, purpose-built for AI workloads such as LLMs, code generation and agents. | 2.1 | [Google page](https://cloud.google.com/tpu) |
| Data centers | Google's own data centres, where its cloud and AI infrastructure runs. Google Cloud spreads workloads across regions and availability zones for reliability and uptime. | 2.1 | EG, [Google page](https://cloud.google.com/infrastructure) |
| Cloud computing | The on-demand availability of computing resources, such as storage and infrastructure, as services over the internet. You do not manage the physical resources and pay only for what you use. | 2.1 | EG, [Google page](https://cloud.google.com/learn/what-is-cloud-computing) |
| Graphics Processing Unit (GPU) | High-performance processors on Google Cloud for machine learning, scientific computing and gen AI. | 2.1 | [Google page](https://cloud.google.com/gpu) |
| Pre-trained models | Models already trained that you can use as they are. Agent Platform provides them alongside infrastructure and tools. | 2.1 | SG p.6 |
| Low-code and no-code tools | Build with gen AI with little or no programming, for example Apps Script and AppSheet. | 2.1 | SG p.7 |
| Apps Script | A cloud-based JavaScript platform, powered by Google Drive, that integrates with and automates tasks across Google products. A low-code way to call the Gemini API. | 2.1 | SG p.7, [Google page](https://developers.google.com/apps-script) |
| AppSheet | Google's no-code platform for building desktop and mobile apps without writing code. A no-code way to build with gen AI. | 2.1 | SG p.7, [Google page](https://about.appsheet.com/home/) |
| Gemini app | Google's gen AI chatbot. Helps with writing, summarising, translating and creating images. | 2.2 | SG p.5 |
| Google AI Pro | The paid Gemini app plan. Formerly called Gemini Advanced. Google's plan names are "Google AI Plus", "Google AI Pro" and "Google AI Ultra", the premium tier. Announced at I/O, May 2025. **Renamed:** Gemini Advanced => Google AI Pro. **Exam guide:** Gemini Advanced. | 2.2 | [Google page](https://blog.google/products-and-platforms/products/gemini/gemini-app-updates-io-2025/), [Google page](https://gemini.google/subscriptions/) |
| Gemini Advanced | Now called Google AI Pro. Exam-guide name for the Gemini app with extra features and enterprise-grade protections for companies. **Renamed:** Gemini Advanced => Google AI Pro. **Exam guide:** Gemini Advanced. | 2.2 | SG p.5 |
| Gems | Personalised AI assistants inside Gemini, built from specific instructions you save. They streamline repeat work such as templates, prompts and guided interactions. Compare Agent. | 2.2 | SG p.8 |
| Saved info in Gemini | Information you store in Gemini so the model uses it consistently in every chat. A way to streamline prompting. | — | SG p.8 |
| Google Workspace with Gemini | Gen AI in Workspace apps: draft emails in Gmail, generate images in Slides, summarise notes in Meet. Formerly called Gemini for Google Workspace. **Renamed:** Gemini for Google Workspace => Google Workspace with Gemini. **Exam guide:** Gemini for Google Workspace. | 2.2 | SG p.5, EG |
| Gemini for Google Workspace | Now called Google Workspace with Gemini. Exam-guide name for gen AI in Workspace apps. **Renamed:** Gemini for Google Workspace => Google Workspace with Gemini. **Exam guide:** Gemini for Google Workspace. | 2.2 | EG, SG p.5 |
| Gemini for Google Cloud | AI assistant for Google Cloud. Writes and debugs code, manages and optimises cloud apps, analyses data in BigQuery, strengthens security posture. Its products include Gemini Code Assist and Gemini Cloud Assist. Google's docs overview is now titled "Google Cloud with Gemini". | — | SG p.5, [Google page](https://docs.cloud.google.com/gemini/docs/overview) |
| Gemini Notebook | Upload your files and it acts as a research assistant: summarises key points, answers questions and generates ideas, grounded in your sources. Formerly called NotebookLM. **Renamed:** NotebookLM => Gemini Notebook. **Exam guide:** Gemini Notebook. | 2.2 | SG p.5, p.11 |
| NotebookLM | Now called Gemini Notebook. notebooklm.google.com now redirects to the Gemini Notebook site. **Renamed:** NotebookLM => Gemini Notebook. **Exam guide:** Gemini Notebook. | — | [Google page](https://notebook.google.com/) |
| Gemini Enterprise | Puts customised search and conversation agents, which understand data from your internal sources, into your organisation's internal websites or dashboards. Course 5 and Google's docs also call it the Gemini Enterprise app. Exam guide examples: Gemini Notebook API, multimodal search, custom agents. | 2.2 | SG p.5, EG |
| Gemini Notebook API | Part of Gemini Enterprise: create, list, share and delete notebooks from code instead of in the app (Preview on 19 Oct). Google's page: "Create and manage notebooks (API)", under Gemini Notebook Enterprise. Exam guide example for Gemini Enterprise. | 2.2 | EG, [Google page](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-notebooks) |
| Multimodal search | Part of Gemini Enterprise: one search across the company's connected sources, such as Confluence, Jira, SharePoint and ServiceNow, that respects each employee's permissions. Google's page: "a single, multimodal search interface offering permissions-aware access to enterprise information". Exam guide example for Gemini Enterprise. | 2.2 | EG, [Google page](https://docs.cloud.google.com/gemini/enterprise/docs) |
| Gemini Enterprise Agent Platform | Formerly called Vertex AI. Also called Agent Platform, and Google's product pages now also call it Gemini platform. Google Cloud's unified ML platform: build, train and deploy ML apps, use and tune models such as Gemini, and build custom agents. **Renamed:** Vertex AI => Gemini Enterprise Agent Platform. **Exam guide:** Gemini Enterprise Agent Platform. | 2.4, 2.5 | SG p.5–6, EG, product page |
| Vertex AI | Now called Gemini Enterprise Agent Platform; Google's naming table dates the change 22 Apr 2026. The old vertex-ai URL redirects to the new product page. **Renamed:** Vertex AI => Gemini Enterprise Agent Platform. **Exam guide:** Gemini Enterprise Agent Platform. | — | Product page, release notes |
| Gemini platform | The name Google's product and comparison pages use for Gemini Enterprise Agent Platform, seen 8 Oct. Google's docs, release notes and the exam guide still say Gemini Enterprise Agent Platform. Not a formal rename. | — | [Google page](https://cloud.google.com/ai/gemini) |
| Agent Search | Search and recommendation solutions for your business. Offers prebuilt RAG. Formerly called Vertex AI Search. **Renamed:** Vertex AI Search => Agent Search. **Exam guide:** Agent Search. | 2.3, 2.4, 3.3 | SG p.5, EG, [Google page](https://cloud.google.com/products/gemini-enterprise-agent-platform/agent-search) |
| Google Search | Google's public web search. The exam guide lists it with Agent Search as one of Google Cloud's external search offerings. Agent Search searches your own data; Google Search searches the public web. Compare Grounding with Google Search, which connects a model to it. | 2.3 | EG |
| Prebuilt RAG | Retrieval-augmented generation that comes ready-made with Agent Search: answers from your own data without building the retrieval yourself. The exam guide's "prebuilt RAG with Agent Search". Compare RAG APIs, for building your own. | 2.4, 3.3 | EG |
| Vertex AI Search | Now called Agent Search: "Agent Search on Gemini Enterprise Agent Platform (formerly Vertex AI Search)". **Renamed:** Vertex AI Search => Agent Search. **Exam guide:** Agent Search. | — | [Google page](https://cloud.google.com/products/gemini-enterprise-agent-platform/agent-search) |
| Agent Conversation | Conversational AI on Gemini Enterprise Agent Platform: natural-sounding chatbots and voicebots, powered by foundation models, for text and audio. A chatbot can be built from a website or a set of documents in a few clicks. Formerly called Vertex AI Conversation. Compare Customer Experience Agent Studio. **Renamed:** Vertex AI Conversation => Agent Conversation. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes), [Google page](https://cloud.google.com/blog/products/ai-machine-learning/vertex-ai-search-and-conversation-is-now-generally-available) |
| Vertex AI Conversation | Now called Agent Conversation: Google's naming table says "Agent Conversation on Gemini Enterprise Agent Platform". **Renamed:** Vertex AI Conversation => Agent Conversation. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| RAG APIs | Build your own RAG. Google Cloud's is RAG Engine (formerly Vertex AI RAG Engine), the Agent Platform component that facilitates retrieval-augmented generation. Compare prebuilt RAG with Agent Search. | 2.4, 3.3 | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/rag-overview) |
| Model Garden | Choose from existing Google, third-party or open-source models. Also stores and organises models in one place. Formerly called Vertex AI Model Garden. | 2.4 | SG p.6, p.9 |
| Model Builder | Train and use your own models: fully custom with an ML framework, or with Agent Platform AutoML. | — | SG p.6 |
| Agent Platform AutoML | Create and train models with minimal technical knowledge and effort. Formerly called Vertex AI AutoML. | 2.4 | SG p.6 |
| Google AI Studio | Free of charge, for quick AI prototyping with the Gemini API. Compare Agent Studio. | 2.5 | SG p.5 |
| Gemini API | How applications call Gemini models from code. The study guide: "Use it with the Gemini API with Google AI Studio or Agent Studio". Compare the Gemini app, for chatting. | — | SG p.5, p.7 |
| Agent Runtime | Formerly called Vertex AI Agent Engine. Google's page: "a set of services that enables developers to deploy, manage, and scale AI agents in production". Compare Agent Studio, for building and testing. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/runtime) |
| Agent Platform Memory Bank | Formerly called Vertex AI Agent Engine Memory Bank. Google's page: it lets you "dynamically generate long-term memories based on user conversations to personalize responses and create cross-session continuity". Compare Agent Platform Sessions, which holds one conversation's history. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/memory-bank) |
| Agent Platform Sessions | Formerly called Vertex AI Agent Engine Sessions. Google's page: "Manage agent interaction history, conversation context, and long-term memory with Agent Platform Sessions via Agent Development Kit (ADK) or API." It keeps each conversation's history and context; Memory Bank turns conversations into long-term memories. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/sessions) |
| Agent Platform Code Execution | Formerly called Vertex AI Agent Engine Code Execution. Google's page: "Code Execution lets your agent run code in a secure, isolated, and managed sandbox environment", for tasks such as financial calculations and data science workflows. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/sandbox/code-execution-overview) |
| RAG Engine | Formerly called Vertex AI RAG Engine. Google's page: "a data framework for building context-augmented LLM applications". It is Google Cloud's RAG APIs option: you build your own RAG. Compare Prebuilt RAG with Agent Search. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/rag-overview) |
| Vector Search | Formerly called Vertex AI Vector Search. Google's page: "Run queries to get nearest neighbors using the k-nearest neighbors algorithm." Google's Agent Retrieval page calls it "a powerful approximate nearest neighbor (ANN) index-as-a-service system". Compare Agent Retrieval. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/vector-search/overview), [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/vector-search-2/overview) |
| Agent Retrieval | Formerly called Vector Search 2.0. Google's page: "a self-tuning, fully managed, AI-native search engine", a single storage and retrieval system for AI applications that removes the need for a separate data store. Compare Vector Search, an index-as-a-service. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/vector-search-2/overview) |
| Agent Platform Managed Training | Formerly called Vertex AI Training. Google's page: "a managed training service that helps you operationalize large scale model training", running training code from any ML framework on Google Cloud infrastructure. Its jobs are also called serverless training. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/training/overview) |
| Managed Training Clusters | Formerly called Vertex AI Training Clusters. Google's page: built "to simplify and accelerate the largest and most complex AI/ML workloads", addressing problems such as complex cluster configuration in large-scale training. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/training/training-clusters/overview) |
| Ray on Agent Platform | Formerly called Ray on Vertex AI. Google's page: "Scale AI and Python applications with Ray on Agent Platform. Take advantage of distributed computing, parallel processing, and MLOps integrations." | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/open-source/ray) |
| Neural Architecture Search | Formerly called Vertex AI Neural Architecture Search. Google's page: "Search for optimal neural architectures involving accuracy, latency, memory, a combination of these, or a custom metric." | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/training/neural-architecture-search/overview) |
| Agent Platform Batch Inference | Formerly called Vertex AI Batch Inference. Google's page: "Get batch inferences from a custom trained model": run a model over a large set of inputs together, when no immediate reply is needed. Compare Agent Platform Online Inference. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/predictions/get-batch-predictions) |
| Agent Platform Online Inference | Formerly called Vertex AI Online Inference. Google's page: "Get online inferences from a custom trained model": answers to individual requests, at low latency, from a model deployed to an endpoint. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/predictions/get-online-predictions) |
| Agent Platform Endpoints | Formerly called Vertex AI Endpoints. Google's page: "To deploy a model for online inference, you need an endpoint." Public endpoints are reachable over the internet; private ones use private networking. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/predictions/choose-endpoint-type) |
| Agent Platform Vision | Formerly called Vertex AI Vision. Google's page: "an AI-powered platform to ingest, analyze and store video data", with a simplified user interface to build and deploy applications. Compare Cloud Vision API, for images. | — | [Google page](https://docs.cloud.google.com/vision-ai/docs/overview) |
| Forecasting on Agent Platform | Formerly called Vertex AI Forecasting, or Forecasting with AutoML. Google's page: the workflow "for creating a forecast model and making predictions in Gemini Enterprise Agent Platform". | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/tabular-data/forecasting/overview) |
| Agent Platform Workbench | Formerly called Vertex AI Workbench. Google's page: "a Jupyter notebook-based development environment for the entire data science workflow". Compare Colab Enterprise. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/notebooks/workbench/introduction) |
| Colab Enterprise | Formerly called Vertex AI Colab Enterprise. Google's page: "a collaborative, managed notebook environment with the security and compliance capabilities of Google Cloud". | — | [Google page](https://docs.cloud.google.com/colab/docs/introduction) |
| Agent Platform Model Evaluation | Formerly called Vertex AI Model Evaluation. Google's page: evaluate model performance across specific use cases; "After you train your model, review model evaluation metrics before you deploy your model." Compare Agent Platform Evals, for generative models. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/evaluation/introduction) |
| Agent Platform Evals | Formerly called the Gen AI evaluation service on Vertex AI. Google's page: "Measure generative model quality using test-driven evaluation and adaptive rubrics." | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/evaluation-overview) |
| Agent Platform Data Labeling | Formerly called Data Labeling on Vertex AI. Google's page: import labeled or unlabeled data and add labels using the Google Cloud console. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/datasets/label-using-console) |
| Agent Platform Experiments | Formerly called Vertex AI Experiments. Google's page: "Find the best model for your problem by tracking and analyzing different model architectures, hyperparameters, and training environments." | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/experiments/intro-vertex-ai-experiments) |
| Firebase AI Logic | Formerly called Vertex AI in Firebase; Google's naming table calls it Gemini Enterprise Agent Platform in Firebase. Google's page: client SDKs to "call the Gemini API directly from your mobile or web app — rather than server-side", with security options against unauthorized clients. | — | [Google page](https://firebase.google.com/docs/ai-logic) |
| Model as a Service (MaaS) | Formerly called Vertex AI MaaS. Google's page: "Leverage partner models for MaaS services in Gemini Enterprise Agent Platform": use partner models as managed services, without hosting them. Google's naming table lists Claude, Llama and DeepSeek on Agent Platform. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/partner-models/use-partner-models) |
| Gemini Live API | Formerly called Gemini Live API on Vertex AI. Google's page: it "enables low-latency, real-time voice and video interactions with Gemini by processing continuous streams of audio, video, or text". | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api) |
| Agent Search for Industry | Formerly called Vertex AI Search for Industry. Agent Search capabilities built for particular industries; Google's media page: "Agent Search includes two capabilities specific for the media industry", search and recommendations. | — | [Google page](https://docs.cloud.google.com/generative-ai-app-builder/docs/about-media) |
| AI Commerce Search | Formerly called Vertex AI Search for Commerce; now part of Gemini Enterprise for Customer Experience. Google's page: implement it "for your ecommerce application", using catalog and user event data to serve search results and recommendations on your site. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-cx/ai-commerce-search/overview) |
| Recommendations AI | Also called Recommendations from Agent Search; formerly Recommendations from Vertex AI Search. Google's page: "Recommendations AI enables retailers and media companies to deliver highly personalized product recommendations at scale". | — | [Google page](https://cloud.google.com/use-cases/recommendations) |
| Reinforcement Learning on Agent Platform | Formerly called RLHF or Reinforcement Learning on Vertex AI. Google's page: "Adapt Gemini models with reinforcement learning fine-tuning by using user-defined reward functions to optimize for reasoning, instruction following, and other custom objectives." Pre-GA on 19 Oct. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/tuning/reinforcement-tuning) |
| Agent Platform on Google Distributed Cloud | Formerly called Vertex AI on GDC. Google's page: Agent Platform's machine learning capabilities on Google Distributed Cloud (GDC) air-gapped, for applications that must stay cut off from the internet. | — | [Google page](https://docs.cloud.google.com/distributed-cloud/hosted/docs/latest/gdcag/application/ao-user/vertex-ai-overview) |
| Agent Platform API | Formerly called Vertex AI API. Google's page: "The Agent Platform API lets you manage Agent Platform resources in Google Cloud", usually through Google's client libraries. Compare the Gemini API, for calling models. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest) |
| Agent Studio | For building and deploying production-ready AI applications at scale with the Gemini API. Formerly called Vertex AI Studio. Compare Google AI Studio. **Renamed:** Vertex AI Studio => Agent Studio. **Exam guide:** Agent Studio. | 2.5 | SG p.5, release notes |
| Vertex AI Studio | Now called Agent Studio. **Renamed:** Vertex AI Studio => Agent Studio. **Exam guide:** Agent Studio. | — | Release notes |
| Gemini Enterprise for Customer Experience | Tools to engage customers effectively, which can be built on Contact Center as a Service. Formerly called Customer Engagement Suite. **Renamed:** Customer Engagement Suite => Gemini Enterprise for Customer Experience. **Exam guide:** Customer Engagement Suite. | 2.3 | SG p.5, EG, product page |
| Customer Engagement Suite | Now called Gemini Enterprise for Customer Experience. Exam-guide name for Google's customer engagement tools; its old product URL now redirects to the renamed product's page. **Renamed:** Customer Engagement Suite => Gemini Enterprise for Customer Experience. **Exam guide:** Customer Engagement Suite. | 2.3 | EG, product page |
| Contact Center as a Service (CCaaS) | Google's enterprise-grade contact centre solution, native to the cloud. | 2.3 | SG p.5 |
| Customer Experience Agent Studio | CX agents that act as chatbots for your customers. Short name CX Agent Studio. Formerly called Conversational Agents. **Renamed:** Conversational Agents => Customer Experience Agent Studio. **Exam guide:** Conversational Agents. | 2.3 | SG p.5, EG, [Google page](https://cloud.google.com/gemini-enterprise-cx/cx-agent-studio) |
| Conversational Agents | Now called Customer Experience Agent Studio. Exam-guide name for the customer-facing chatbots; the Dialogflow product page now redirects to CX Agent Studio. **Renamed:** Conversational Agents => Customer Experience Agent Studio. **Exam guide:** Conversational Agents. | 2.3 | EG, SG p.5 |
| Agent Assist | Supports your live human contact-centre agents. | 2.3 | SG p.5 |
| Customer Experience Insights | Insights into all your communications with customers. Formerly called Conversational Insights. **Renamed:** Conversational Insights => Customer Experience Insights. **Exam guide:** Conversational Insights. | 2.3 | SG p.5, EG, product page |
| Conversational Insights | Now called Customer Experience Insights. Exam-guide name for insights into customer communications. **Renamed:** Conversational Insights => Customer Experience Insights. **Exam guide:** Conversational Insights. | 2.3 | EG, SG p.5 |
| MLOps | An ML engineering culture and practice that aims at unifying ML system development (Dev) and operation (Ops). Agent Platform's MLOps tools help AI teams collaborate to monitor and improve their models. | — | SG p.6, [Google page](https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning) |
| Agent | An application that tries to reach a goal by observing the world and acting on it with its tools. Parts: reasoning loop, tools, model. | 2.5 | SG p.6 |
| Model (agent component) | The brains of an agent: algorithms that learn patterns from data and can make predictions or generate new content. One of an agent's three parts, with the reasoning loop and tools. | 2.5 | SG p.6 |
| Tools (agent component) | The functionalities that let an agent interact with its environment, such as accessing and processing data or interacting with hardware. Extensions, functions, data stores and plugins are kinds of tool. | 2.5 | SG p.6, p.5 |
| Agent instructions | The natural-language definition of a generative agent's goal and behaviour. Writing them is prompt engineering. | 2.5 | SG p.6 |
| Reasoning loop | The agent's repeated cycle of observing, interpreting, reasoning and acting, often using prompt engineering. | 2.5 | SG p.6 |
| Deterministic agent | Traditional agent built with predefined paths and actions. | — | SG p.6 |
| Generative agent | Agent defined in natural language, using LLMs to give a real conversational feel. | — | SG p.6 |
| Hybrid agent | Combines deterministic and generative capabilities. | — | SG p.6 |
| Extensions | Agent tool that connects to external services through APIs. Part of the agent's design, not its prompt. | 2.5 | SG p.5 |
| Functions | Agent tool that defines a specific action or task. | 2.5 | SG p.5 |
| Data stores | Agent tool that gives access to information. | 2.5 | SG p.5 |
| Plugins | Agent tool that adds new skills and integrations. | 2.5 | SG p.5 |
| Speech-to-Text API | Converts speech into text and transcribes audio and video. | 2.5 | SG p.7 |
| Text-to-Speech API | Converts text into natural-sounding speech. Used for voice interfaces and personalised communication. | 2.5 | SG p.7 |
| Translation API | Translates text, documents, websites, audio and video files. | 2.5 | SG p.7 |
| Document Translation API | Translates formatted documents and keeps the original layout. | 2.5 | SG p.7 |
| Document AI API | Extracts data from varied formats, automates document processing and can summarise documents. | 2.5 | SG p.7 |
| Cloud Vision API | Analyses images: tags objects and text, identifies faces and landmarks. Used for content moderation and visual search. | 2.5 | SG p.7 |
| Cloud Video Intelligence API | Analyses video and extracts meaningful information. Used for content recommendation, video search and media analysis. | 2.5 | SG p.7 |
| Natural Language API | Derives insights from unstructured text: sentiment, content classification and important entities. | 2.5 | SG p.7 |
| Google Cloud API Library | The Google Cloud console page where you browse the available Google Cloud APIs, find the ones you need and enable them. | 2.5 | [Google page](https://docs.cloud.google.com/apis/docs/getting-started) |
| Cloud Storage | A managed service for storing unstructured data as objects. A common place for ML training data, models and checkpoints. | 2.5 | [Google page](https://cloud.google.com/storage) |
| Databases | Google Cloud's managed databases, such as Spanner, built with AI at the core. Agents use them as a tool to read and store data. | 2.5 | [Google page](https://cloud.google.com/products/databases) |
| Cloud Run | A fully managed platform that runs your code on Google's scalable infrastructure: services, batch jobs, even hosted LLMs, with no infrastructure to manage. A way to build apps from agents. | 2.5 | SG p.7, [Google page](https://cloud.google.com/run) |
| Cloud Run functions | Event-driven functions that run on Cloud Run. A way to call the Gemini API from your apps. Formerly called Cloud Functions. **Renamed:** Cloud Functions => Cloud Run functions. **Exam guide:** Cloud Functions. | 2.5 | SG p.7, [Google page](https://cloud.google.com/functions) |
| Cloud Functions | Now called Cloud Run functions. Exam-guide name. Google's page: "Cloud Functions is now Cloud Run functions". **Renamed:** Cloud Functions => Cloud Run functions. **Exam guide:** Cloud Functions. | 2.5 | EG, [Google page](https://cloud.google.com/functions) |
| AI on the edge | Running AI on devices or servers close to where the action happens. | — | SG p.6 |
| Lite Runtime (LiteRT) | Google's tool for deploying AI models on edge devices. Formerly called TensorFlow Lite. **Renamed:** TensorFlow Lite => Lite Runtime (LiteRT). | — | SG p.6 |
| TensorFlow Lite | Now called LiteRT; Google's LiteRT docs carry a "Migrating from TensorFlow Lite" guide. **Renamed:** TensorFlow Lite => Lite Runtime (LiteRT). | — | [Google page](https://developers.google.com/edge/litert) |
| Gemini Nano | Google's most efficient, compact model, designed to run on devices. | — | SG p.6 |

## Section 3 — Techniques to improve gen AI model output

| Term | Meaning | Guide | Source |
|---|---|---|---|
| Data dependency | Model performance relies heavily on data; biased or incomplete data affects the outputs. | 3.1 | SG p.9 |
| Knowledge cutoff | Models are trained up to a cutoff date, so they may lack information about later events. | 3.1 | SG p.9 |
| Bias | Models learn from large datasets that may contain biases; even subtle biases can be magnified in the outputs. | 3.1, 4.3 | SG p.9 |
| Fairness | Assessing whether a model is fair. A key part of responsible development. | 3.1, 4.3 | SG p.9 |
| Hallucination | Output that isn't accurate or isn't based on real information. | 3.1 | SG p.9 |
| Edge cases | Rare, atypical scenarios that expose a model's weaknesses and cause unexpected results. | 3.1 | SG p.9 |
| Grounding | Connecting the model's output to verifiable sources of information. | 3.1, 3.3 | SG p.8 |
| Grounding with first-party enterprise data | Grounding on your organisation's own data, for example with RAG over your website or documents in Agent Search, or your Elasticsearch indexes. | 3.3 | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/grounding/overview) |
| Grounding with third-party data | Grounding on data from outside providers rather than your own or the public web. Exam-guide term; no Google definition found on 30 Sept. | 3.3 | EG |
| Grounding with world data | Grounding on world knowledge and up-to-date public information. Google's offering is Grounding with Google Search. | 3.3 | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/grounding/grounding-with-google-search) |
| Grounding with Google Maps | Grounds the model on Google Maps data for more accurate, location-aware answers. Another Google grounding offering; not in the exam guide. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/grounding/overview) |
| Web Grounding for Enterprise | Grounding on a web index with extra compliance controls, for customers in highly regulated industries. Without those needs, use Grounding with Google Search. Not in the exam guide. | — | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/grounding/web-grounding-enterprise) |
| Grounding with Google Search | Connects the model to world knowledge, a wide range of topics or up-to-date information on the internet. Google Search is also one of Google's external search offerings. | 2.3, 3.3 | [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/grounding/grounding-with-google-search) |
| Retrieval-augmented generation (RAG) | Retrieve relevant information with tools, add it to the prompt, then generate; the retrieval can repeat. A way to ground output. | 3.1, 3.3 | SG p.8 |
| Fine-tuning | A second, task-specific training pass on a pre-trained model that refines its parameters. Changes the model itself. | 1.1, 3.1 | MLG, SG p.9 |
| Human in the loop (HITL) | Human input and feedback built into ML workflows. Used for content moderation, sensitive fields such as healthcare and finance, high-risk decisions, and review before or after generation. | 3.1 | SG p.9 |
| Zero-shot prompting | Asking the model to do a task with no examples. | 3.2 | SG p.8 |
| One-shot prompting | Giving the model one example to learn from. | 3.2 | SG p.8 |
| Few-shot prompting | Giving the model several examples to learn from. | 3.2 | SG p.8 |
| Role prompting | Giving the model a persona to shape its style, tone and focus. | 3.2 | SG p.8 |
| Prompt chaining | A back-and-forth conversation with the model in the same chat, so it keeps the context. | 3.2 | SG p.8 |
| Chain-of-thought (CoT) prompting | Guiding the model through a problem with examples that show the intermediate reasoning steps. Compare ReAct, which also takes action. | 3.2 | SG p.8 |
| ReAct prompting | Reason and act: the model reasons about a user's query and takes action on it. | 3.2 | SG p.8 |
| Metaprompting | Using prompts to make the model generate, modify or interpret other prompts. | — | SG p.8 |
| Reusing prompts | Saving prompts as templates for repeated use. A way to streamline prompting, alongside prompt chaining, saved info and Gems. | — | SG p.8 |
| Token count | The number of tokens: meaningful chunks of text such as words and punctuation. | 3.3 | SG p.8 |
| Temperature | Controls the randomness, or "creativity", of the model's word choices. Compare top-p. | 3.3 | SG p.8 |
| Top-p (nucleus sampling) | The cumulative probability of the most likely tokens the model considers when generating. Another way to control randomness. | 3.3 | SG p.8 |
| Safety settings | Filter potentially harmful or inappropriate content out of the model's output. | 3.3 | SG p.8 |
| Output length | The maximum length of the generated text. | 3.3 | SG p.8 |
| Agent Platform Model Registry | Keeps track of the different versions of a model (versioning). Formerly called Vertex AI Model Registry; the study guide says Model Registry. **Renamed:** Model Registry => Agent Platform Model Registry. | 3.1 | SG p.9, release notes |
| Model Registry | Now called Agent Platform Model Registry. Study-guide name for the versioning tool. **Renamed:** Model Registry => Agent Platform Model Registry. | 3.1 | SG p.9 |
| Versioning | Keeping track of the different versions of a model, with Agent Platform Model Registry. | 3.1 | SG p.9 |
| Automatic model upgrades | Google retires model versions on published dates and asks you to migrate to the latest stable model; plan for the model under your app to change. | 3.1 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions) |
| Security patches and updates | Keeping models and the systems around them patched and up to date as part of continuous monitoring. Exam-guide term; no Google definition found on 30 Sept. | 3.1 | EG |
| Key performance indicators (KPIs) | Clear metrics that track progress. For gen AI: model accuracy, operational efficiency, user engagement and financial impact. | 3.1, 4.1 | [Google page](https://cloud.google.com/transform/gen-ai-kpis-measuring-ai-success-deep-dive) |
| Performance tracking | Reviewing a model's metrics to check how it performs. | 3.1 | SG p.9 |
| Drift monitoring | Watching for changes in a model's accuracy over time, with Model Monitoring on Agent Platform. | 3.1 | SG p.9 |
| Model Monitoring on Agent Platform | Watches a model's accuracy over time and flags drift. Formerly called Vertex AI Model Monitoring; the study guide says Model Monitoring. | 3.1 | SG p.9, release notes |
| Agent Platform Feature Store | Manages the data features a model uses. Formerly called Vertex AI Feature Store. | 3.1 | SG p.9 |
| Agent Platform Pipelines | Automates machine learning tasks. Formerly called Vertex AI Pipelines. | — | SG p.9 |

## Section 4 — Business strategies for a successful gen AI solution

| Term | Meaning | Guide | Source |
|---|---|---|---|
| Gen AI strategy | Combine top-down (leaders set the vision and strategy) with bottom-up (employees find practical uses and give feedback). | 4.1 | SG p.10 |
| Gen AI needs | What to settle before a gen AI project: scale, customisation, user interaction, privacy, latency and connectivity. The business-requirement side of 4.1. | 4.1 | SG p.10 |
| Gen AI resources | What you have to work with: people (AI expertise), money (budget) and time (timelines). The constraint side of 4.1. | 4.1 | SG p.10 |
| Steps to integrate gen AI | Establish a clear vision, prioritise use cases, invest in capabilities, manage change, measure value and champion responsible AI. | 4.1 | SG p.10 |
| Establish a clear vision | First step to integrate gen AI: agree what gen AI should achieve for the organisation. | 4.1 | SG p.10 |
| Prioritize use cases | Step to integrate gen AI: choose which possible uses to fund first. | 4.1 | SG p.10 |
| Invest in capabilities | Step to integrate gen AI: build the data, tools and skills the chosen use cases need. | 4.1 | SG p.10 |
| Manage change | Step to integrate gen AI: help people adapt as their work changes. | 4.1 | SG p.10 |
| Measure value | Step to integrate gen AI: show what the gen AI work has delivered. | 4.1 | SG p.10 |
| Champion responsible AI | Step to integrate gen AI: make sure the organisation's gen AI is ethical and safe from the start. | 4.1 | SG p.10 |
| Strategic focus | Prioritise focused gen AI implementations with clear business value. | 4.1 | SG p.10 |
| Exploration | Encourage experimentation and collaboration to discover valuable gen AI applications. | 4.1 | SG p.10 |
| Resourcing | Invest in data strategy, use existing resources and develop AI talent. | 4.1 | SG p.10 |
| Impact | Measure gen AI's impact on business goals and show tangible benefits, for example with KPIs. | 4.1 | SG p.10 |
| Continuous improvement | Keep refining gen AI solutions based on feedback and data. | 4.1 | SG p.10 |
| Secure AI | Protecting your AI applications from harm. | 4.2 | SG p.10 |
| Secure AI Framework (SAIF) | Google's framework that helps organisations manage AI/ML model risks and ensure security. | 4.2 | SG p.10 |
| Secure-by-design infrastructure | Google Cloud's infrastructure that helps support security across the AI/ML lifecycle. | 4.2 | SG p.10 |
| Identity and Access Management (IAM) | Controls access to Google Cloud resources. You grant a principal (who) a role (what access) on a resource, through the resource's allow policy. | 4.2 | SG p.10, IAM |
| Least privilege | Give each principal only the access it needs. Google's guidance: in production, do not grant basic roles, which carry thousands of permissions, unless there is no alternative. | 4.2 | IAM security |
| Security Command Center | Gives visibility of your security posture. | 4.2 | SG p.10 |
| Workload monitoring tools | Help build and maintain secure AI systems. | 4.2 | SG p.10 |
| Responsible AI | Making sure AI applications don't cause harm and are used ethically, from data preparation to ongoing monitoring. | 4.3 | SG p.10 |
| Transparency | Making clear how a model works and when it doesn't. Google provides it through resources such as Explainable AI and Model Cards. | 4.3 | [Google page](https://cloud.google.com/responsible-ai) |
| Privacy | How sensitive the data is. Google's AI Principles commit to safeguarding user privacy and promoting privacy and security. | 4.3 | SG p.10, [Google page](https://ai.google/principles/) |
| Data anonymization | Removing identifying information from data so people cannot be identified. Google's docs call it de-identification; masking characters is one technique. | 4.3 | [Google page](https://docs.cloud.google.com/sensitive-data-protection/docs/deidentify-sensitive-data) |
| Pseudonymization | A de-identification technique that replaces sensitive values with cryptographically generated tokens. Two-way tokens can be reversed with the key; one-way tokens cannot. | 4.3 | [Google page](https://docs.cloud.google.com/sensitive-data-protection/docs/pseudonymization) |
| Accountability | Knowing when AI systems perform as intended and when they don't, with human oversight and human review of outputs. | 4.3 | [Google page](https://cloud.google.com/responsible-ai), SG p.9 |
| Explainability | Understanding why a model made a decision, to build confidence and see when and why things go wrong. Google's Vertex Explainable AI tool is deprecated since 16 Mar 2026; the concept stays on the exam. | 4.3 | [Google page](https://docs.cloud.google.com/vertex-ai/docs/explainable-ai/overview) |
