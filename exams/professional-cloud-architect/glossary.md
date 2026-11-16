# Glossary — Professional Cloud Architect

One term per row. **Guide** is the exam-guide section; "—" means the exam guide's bullet names the topic
but not this product, so the quiz files the term under the section whose bullet it serves. **Source** is where
the meaning comes from; each is an official Google page, linked in its row:

- **EG** — Google's [exam guide](https://services.google.com/fh/files/misc/professional_cloud_architect_exam_guide_english.pdf)
- **Google page** — any other official Google page, linked in its own row.

Meanings are short summaries in this repo's own words, checked against the page the row cites. Where
Google renames a product, both names get a row that points to the other, as the Generative AI Leader
pack's glossary explains. Learn the exam guide's name for each.

Validated against Google docs: 2026-11-16

## Section 1 — Designing and planning a cloud solution architecture

| Term | Meaning | Guide | Source |
|---|---|---|---|
| Google Cloud Well-Architected Framework | Google's architectural recommendations and best practices for designing a secure, efficient and resilient cloud topology that is optimised for cost, performance and sustainability. Its pillars are operational excellence, security, reliability, performance optimization, cost optimization and sustainability. | 1.2, 6.1 | EG, [Google page](https://docs.cloud.google.com/architecture/framework) |
| Gemini Cloud Assist | An AI-powered collaborator in Google Cloud that gives agentic guidance for designing, deploying, troubleshooting and optimising workloads. It moves teams from reactive troubleshooting towards proactive operations. | 1.2, 5.1 | EG, [Google page](https://docs.cloud.google.com/cloud-assist/overview) |
| Backup and DR Service | A managed service for centralised, policy-based backup and recovery of enterprise workloads that run in Google Cloud and in hybrid environments. | — | [Google page](https://docs.cloud.google.com/backup-disaster-recovery/docs/concepts/backup-dr) |
| Virtual Private Cloud (VPC) | A virtual version of a physical network, implemented inside Google's production network. It gives your VMs and other resources connectivity, with their own subnets, routes and firewall rules. | 1.3 | EG, [Google page](https://docs.cloud.google.com/vpc/docs/vpc) |
| VPC Network Peering | Connects two VPC networks so that resources in each can talk over internal IP addresses. The networks can be in the same project, different projects or different organisations, and each side stays administered separately. | 1.3 | EG, [Google page](https://docs.cloud.google.com/vpc/docs/vpc-peering) |
| Shared VPC | Lets an organisation connect resources from several projects to one common VPC network, hosted in a host project, so they communicate over internal IP addresses while the network is managed centrally. | 1.3 | EG, [Google page](https://docs.cloud.google.com/vpc/docs/shared-vpc) |
| Private Service Connect | A Google Cloud networking capability that lets consumers reach managed services privately from inside their own VPC network, using an internal IP address in that network. | 1.3 | EG, [Google page](https://docs.cloud.google.com/vpc/docs/private-service-connect) |
| Cloud Next Generation Firewall (Cloud NGFW) | A distributed, cloud-native firewall service that secures Google Cloud workloads with firewall rules and policies applied to VPC networks. | — | [Google page](https://docs.cloud.google.com/firewall/docs/about-firewalls) |
| Cloud Load Balancing | Distributes user traffic across multiple instances of an application, which reduces the risk of performance problems. Google offers several types of load balancer. | — | [Google page](https://docs.cloud.google.com/load-balancing/docs/load-balancing-overview) |
| Model Garden | A library of AI and ML models in Gemini Enterprise Agent Platform where you discover, test, customise and deploy models and assets from Google and its partners. | 1.3 | EG, [Google page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-garden/explore) |
| AI Hypercomputer | An integrated supercomputing system, and Google Cloud's unified portfolio of AI infrastructure, optimised for AI and ML workloads. | 1.3 | EG, [Google page](https://docs.cloud.google.com/ai-hypercomputer/docs/overview) |
| Google Kubernetes Engine (GKE) | Google's managed implementation of the open source Kubernetes container orchestration platform, for deploying containerised applications on Google Cloud. It comes in Autopilot and Standard modes. | 1.3 | EG, [Google page](https://docs.cloud.google.com/kubernetes-engine/docs/concepts/kubernetes-engine-overview) |
| Cloud Run | A fully managed application platform for running your code, a function or a container on Google's scalable infrastructure, in any programming language. | 1.3 | EG, [Google page](https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run) |
| Cloud Run functions | The latest version of Google's function-as-a-service, where you write just a function and it is deployed as a service on Cloud Run. Google advises moving functions from the older Cloud Functions API to Cloud Run. | 1.3 | EG, [Google page](https://docs.cloud.google.com/run/docs/functions/comparison) |
| Spot VMs | Compute Engine VM instances made from excess capacity, at a large discount. Google may preempt (stop or delete) them at any time, so they suit fault-tolerant work such as batch jobs. | 1.3 | EG, [Google page](https://docs.cloud.google.com/compute/docs/instances/spot) |
| Custom machine types | A Compute Engine option to pick your own number of vCPUs and amount of memory when no predefined machine type fits. They are available for the N and E series of the general-purpose family, and for the G2 series. | 1.3 | EG, [Google page](https://docs.cloud.google.com/compute/docs/instances/creating-instance-with-custom-machine-type) |
| Google Cloud Migration Center | A unified platform for moving to Google Cloud. It estimates cloud costs, discovers and assesses your existing assets, and offers tools for different migration scenarios, without changing your workloads. | 1.4 | EG, [Google page](https://docs.cloud.google.com/migration-center/docs/migration-center-overview) |
| Cloud Storage | Object storage for unstructured data, with high durability and global availability. Typical uses are distributing web content and storing datasets for analytics and machine learning. | — | [Google page](https://docs.cloud.google.com/storage/docs/introduction) |
| Filestore | Fully managed file servers on Google Cloud that Compute Engine VMs, GKE clusters and other clients can mount as a shared file system. | — | [Google page](https://docs.cloud.google.com/filestore/docs/overview) |
| Cloud SQL | A fully managed relational database service for MySQL, PostgreSQL and SQL Server, which removes routine database administration. | — | [Google page](https://docs.cloud.google.com/sql/docs/introduction) |
| Spanner | A database that combines relational, graph, key-value and search in one service, with virtually unlimited scale and no maintenance windows. | — | [Google page](https://cloud.google.com/spanner) |
| Bigtable | A sparsely populated table that scales to billions of rows and thousands of columns, for terabytes or petabytes of single-keyed data. | — | [Google page](https://docs.cloud.google.com/bigtable/docs/overview) |
| Firestore | A fully managed document database with multi-region replication, advanced queries, ACID transactions and a 99.999% availability SLA. | — | [Google page](https://docs.cloud.google.com/firestore/native/docs/overview) |
| BigQuery | A fully managed, serverless data platform for analysing data at scale with SQL and Python, built for analytics and AI. | — | [Google page](https://docs.cloud.google.com/bigquery/docs/introduction) |
| Dataflow | A managed service for unified stream and batch data processing at scale. You build pipelines that read from sources, transform the data and write it out, using Apache Beam. | — | [Google page](https://docs.cloud.google.com/dataflow/docs/overview) |
| Managed Service for Apache Spark | Runs open source data tools such as Apache Spark for batch processing, querying, streaming and machine learning on clusters that are quick to create and can be turned off when idle. Formerly called Dataproc on Compute Engine. **Renamed:** Dataproc on Compute Engine => Managed Service for Apache Spark. | — | [Google page](https://docs.cloud.google.com/managed-spark/docs/concepts/clusters-overview) |
| Dataproc on Compute Engine | Now called Managed Service for Apache Spark, which covers the cluster deployment of the product. **Renamed:** Dataproc on Compute Engine => Managed Service for Apache Spark. | — | [Google page](https://docs.cloud.google.com/managed-spark/docs/concepts/clusters-overview) |
