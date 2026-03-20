# DeepLearning.AI Data Engineering Professional Certificate

## Complete Program Reference

*Based on: Fundamentals of Data Engineering, Joe Reis & Matt Housley*

---

## Program Overview

| Course | Title | Weeks | Focus |
|--------|-------|-------|-------|
| C1 | Introduction to Data Engineering | 4 | DE role, lifecycle, undercurrents, architecture, requirements, AWS lab |
| C2 | Source Systems, Data Ingestion, and Pipelines | 4 | Source systems, ingestion (batch/streaming), DataOps, orchestration |
| C3 | Data Storage and Queries | 3 | Storage hierarchy, abstractions (warehouse/lake/lakehouse), queries, indexes, advanced SQL |
| C4 | Data Modeling, Transformation, and Serving | 4 | Star schema, Data Vault, ML data prep, Spark/MapReduce, serving, capstone |

---

---

# Course 1 -- Introduction to Data Engineering

## Complete Reference Notes (v2)

*Based on: Fundamentals of Data Engineering, Joe Reis & Matt Housley*

---

## Table of Contents -- Course 1

- [Course Structure](#course-1-structure)
- [Week 1: Introduction to Data Engineering](#c1-week-1-introduction-to-data-engineering)
- [Week 2: The Data Engineering Lifecycle and Undercurrents](#c1-week-2-the-data-engineering-lifecycle-and-undercurrents)
- [Week 3: Data Architecture](#c1-week-3-data-architecture)
- [Week 4: Bringing It All Together](#c1-week-4-bringing-it-all-together)

---

## Course 1 Structure

| Week | Title | Core Topics |
|------|-------|------------|
| 1 | Introduction to Data Engineering | History, DE definition, Data Maturity Model, Lifecycle overview, 4-step framework, Business Value, Stakeholders, AWS Cloud |
| 2 | The Data Engineering Lifecycle & Undercurrents | Lifecycle stages in depth (Generation, Ingestion, Storage, Transformation, Serving), 6 Undercurrents, One-Way/Two-Way Decisions |
| 3 | Data Architecture | Conway's Law, 9 Principles, Batch/Streaming architectures, Lambda/Kappa/Unified patterns, Compliance, Tools |
| 4 | Bringing It All Together | Requirements gathering, Stakeholder management, Iron Triangle, AWS Recommender System lab (batch + streaming) |

---

## C1 Week 1: Introduction to Data Engineering

### History of Data Engineering

| Era | Key Developments | Notable People / Companies |
|-----|-----------------|---------------------------|
| **1960s** | Mainframe computers; early database systems | -- |
| **1970s** | SQL invented; relational databases emerge | -- |
| **1980s** | Data warehouses emerge; Business Intelligence (BI); data modeling formalized | **Bill Inmon** (data warehouse pioneer), **Ralph Kimball** (dimensional modeling) |
| **1990s** | Internet era; web-first companies emerge; backend data systems grow | Amazon and other web companies |
| **2000s** | **Big Data** era; cloud computing begins | Yahoo, Google, Amazon |
| **2010s--present** | Abstract simplified tools; cloud-first; modern data stack | AWS, GCP, Azure ecosystem |

#### The Big Data Era (2000s)

> **Big Data:** "Extremely large data sets that may be analyzed computationally to reveal patterns, trends, and associations, especially relating to human behavior and interactions."

Big Data is characterized by the **3 Vs:**

| V | Meaning |
|---|---------|
| **Velocity** | Speed at which data is generated and needs to be processed |
| **Variety** | Different types and formats of data (structured, semi-structured, unstructured) |
| **Volume** | Massive scale of data being generated |

**Key milestones:**
- **2004:** Google publishes the **MapReduce** paper -- distributed batch processing paradigm
- **2006:** Yahoo releases **Hadoop** -- open-source implementation of MapReduce
- This period created the **"Big Data Engineer"** role

#### The Cloud Era

**AWS** became the first popular **public cloud** -- a pay-as-you-go resource marketplace offering services like EC2 (compute), S3 (storage), and DynamoDB (NoSQL).

**Public Cloud providers:** AWS, Google Cloud Platform, Microsoft Azure

#### The Modern Era (2010s--present)

Defined by **abstract simplified tools** -- cloud services, managed APIs, data sources, and modular pipeline components that dramatically reduce infrastructure burden. Key characteristics:
- Access to bleeding-edge data tools without managing infrastructure
- Transition from batch computing to **event streaming**
- Shift from "Big Data Engineer" to simply "Data Engineer"

---

### What is a Data Engineer?

> **"Take in raw data and produce high-quality, consistent information that supports downstream use cases"**

**Two archetypes:**

| Type | Name | Approach |
|------|------|----------|
| **Type A** | **Abstraction** | Use managed/abstracted tools; minimize unnecessary complexity; focus on leveraging existing services |
| **Type B** | **Build** | Build custom data infrastructure and internal systems; deeper technical involvement |

---

### Data Maturity Model

Three stages of an organization's data maturity:

| Stage | Name | Characteristics |
|-------|------|----------------|
| **1** | Starting with Data | Early/ad hoc data usage; DE wears many hats; limited data culture |
| **2** | Scaling with Data | Formalizing data practices; growing dedicated data teams; establishing processes |
| **3** | Leading with Data | Automated pipelines; data-driven decision making throughout the organization; mature data culture |

---

### The Data Engineering Lifecycle

```
Data Sources
    |
    v
Generation --> Ingestion --> Transformation --> Serving
                                                    |
                                         +----------+------------+
                                         |          |            |
                                    Analytics   Machine      Reverse
                                    & Reports   Learning       ETL
                                                              |
                                                    (back to source systems)

                    +-------------------------------------+
                    |           STORAGE                    |
                    |   (underpins ALL lifecycle stages)   |
                    +-------------------------------------+
```

**Key insight:** Storage underpins every stage -- data is stored at ingestion, during transformation, and before serving.

---

### Downstream Use Cases

Data engineers serve three primary downstream use cases:

1. **Analytics & Reports** -- Dashboards and reports for decision makers
2. **Machine Learning** -- Training data pipelines and feature stores for model training
3. **Reverse ETL** -- Feed processed/enriched data back to operational systems

---

### Stakeholders

#### Downstream Stakeholders (Data Consumers)

The data engineer serves these stakeholders who consume processed data:

- **Analysts** -- Use SQL queries to analyze data and build reports
- **Data Scientists** -- Build predictive models and perform advanced analytics
- **Machine Learning Engineers** -- Deploy and maintain ML models in production
- **Salespeople** -- Need data for customer outreach and pipeline management
- **Marketing Professionals** -- Require data for campaigns, demand analysis, customer segmentation
- **Executives** -- Need high-level metrics and KPIs for strategic decisions

**Key questions to ask downstream stakeholders:**
- What timezone do they need data in?
- How often do they need data refreshed?
- What specific information do they need?
- How much latency can they tolerate?

#### Upstream Stakeholders (Data Producers)

**Software Engineers** are the primary upstream stakeholders who control source systems. Key questions:

- What is the **volume** of data being generated?
- What is the **frequency** of data generation?
- What **format** is the data in?
- What are the **data security** requirements?
- Are there **regulatory compliance** concerns?

```
Upstream Stakeholders        Data Engineer         Downstream Stakeholders
(Software Engineers)  --->  (Data Consumer &  --->  (Analysts, DS, MLE,
                             Data Producer)          Sales, Marketing, Execs)
```

---

### Business Value of Data Engineering

- **Business Value = Benefits - Costs**
- **Total Cost of Ownership (TCO) = Direct Costs + Indirect Costs**
- The overarching goal is **Revenue Growth**
- All data products must deliver measurable value to stakeholders
- Value is created when a pipeline helps the business; no value is created when it does not

**Critical self-check:** "Is your work helping stakeholders achieve their goals?"

---

### Thinking Like a Data Engineer -- 4-Step Framework

This is the core operating framework. It is **cyclical** -- Step 4 always loops back to Step 1.

```
+-----------------------------------------------------------------------------+
|  1                    2                    3                    4            |
|  Identify business    Define system        Choose tools &       Build,      |
|  goals &              requirements         technologies         evaluate,   |
|  stakeholder needs                                              iterate &   |
|                                                                 evolve      |
|                                                                    |        |
|  <-------------------------------------------------------------- +         |
+-----------------------------------------------------------------------------+
```

#### Step 1: Identify Business Goals & Stakeholder Needs

1. Identify business goals and the stakeholders you will serve
2. Explore existing systems and stakeholder needs
3. Ask stakeholders what **actions** they will take with the data product

#### Step 2: Define System Requirements

1. Translate stakeholder needs into **functional requirements**
2. Define **non-functional requirements** (latency, scalability, reliability, cost, security)
3. Document and **confirm requirements with stakeholders**

#### Step 3: Choose Tools & Technologies

1. Identify tools and technologies to meet non-functional requirements
2. Perform **cost/benefit analysis** and choose between comparable options
3. Prototype and test your system; align with stakeholder needs

#### Step 4: Build, Evaluate, Iterate & Evolve

1. Build and deploy your production data system
2. Monitor, evaluate, and iterate on your system to improve it
3. Evolve your system based on changing stakeholder needs -- **loop back to Step 1**

#### Requirements Types

| Type | Definition | Examples |
|------|-----------|---------|
| **Functional** | What the system should do | "Ingest data every 15 minutes"; "Support SQL queries on sales data" |
| **Non-functional** | How the system should perform | Latency < 1s; 99.9% availability; cost < $500/month; throughput targets |

---

### Data Engineering on the Cloud

#### Location Options

| Location | Description | Key Characteristics |
|----------|-------------|---------------------|
| **On-Premises** | Company **owns and maintains** hardware and software | Provisioning, Maintaining, Updating, Scaling are all your responsibility |
| **Cloud** | Cloud provider builds/maintains hardware in data centers | You **rent** compute and storage; elastic scale up/down; no hardware management |
| **Hybrid** | Mix of on-premises and cloud | Common during cloud migration or for regulatory reasons |

**Reasons to stay on-premises:** Regulatory concerns, Legacy systems

#### AWS Specialization Approach (Cloud-First)

AWS services used throughout the course:

| AWS Service | Purpose |
|------------|---------|
| Amazon RDS | Relational database (source system, vector DB) |
| Amazon S3 | Object storage -- data lake, ML artifacts |
| Amazon DynamoDB | NoSQL high-throughput key-value store |
| Amazon Athena | Serverless SQL query engine over S3 |
| AWS Glue | ETL service + Crawler (schema discovery) |
| Amazon Kinesis | Real-time event streaming |
| Amazon Redshift | Data warehouse -- store, transform, serve |

---

### AWS Core Services

#### IT Resource Categories

| Category | Purpose | Services |
|----------|---------|---------|
| **Compute** | Places to run code | Amazon EC2 (VMs), AWS Lambda (serverless), Amazon ECS, Amazon EKS (containers) |
| **Storage** | Places to store data | Amazon S3, Amazon EBS, Amazon EFS, Database Services |
| **Networking** | Connect resources | Amazon VPC |

#### AWS Regions and Availability Zones

- **Regions:** Collections of data centers within geographical areas
- **Availability Zones (AZs):** Multiple isolated data centers within each region
  - If AZ1 fails, AZ2 takes over -- provides high reliability and availability

#### Storage Types

| Type | Service | Use Case |
|------|---------|---------|
| **Object** | Amazon S3 | Unstructured data, data lake |
| **Block** | Amazon EBS | DB storage, VM file systems, low-latency |
| **File** | Amazon EFS | Hierarchical files and directories |

---

### AWS Shared Responsibility Model

> "AWS is responsible for security **OF** the cloud, and you are responsible for security **IN** the cloud"

| Responsibility | Owner | Covers |
|----------------|-------|--------|
| **Security OF the cloud** | **AWS** | Hardware/Global Infrastructure; Software (Compute, Storage, Database, Networking) |
| **Security IN the cloud** | **Customer** | Customer Data; Platform/Applications/IAM; OS/Network/Firewall Config; Encryption; Networking Traffic Protection |

---

## C1 Week 2: The Data Engineering Lifecycle and Undercurrents

### Generation -- Source Systems

Where data originates. A critical insight:

> **The Data Engineer does NOT control source systems.** Source systems are controlled by **Software Engineers**.

---

### Source System Types

| Source Type | Examples / Details | Characteristics |
|-------------|-------------------|----------------|
| **Databases -- Relational** | MySQL, PostgreSQL, Oracle | Normalized for transactions; row-oriented; OLTP |
| **Databases -- NoSQL** | Key-Value stores, Document stores | Flexible schemas; optimized for specific access patterns |
| **Files** | Text (TXT), Audio (MP3), Video (MP4) | Batch exports, static snapshots, unstructured data |
| **APIs** | REST APIs | Structured request/response; data returned as `.xml` or `.json` |
| **Data Sharing Platforms** | Third-party data providers | External or internal shared data sources |
| **IoT Devices** | Cameras, light bulbs, phones, printers | A "swarm" of connected devices; continuous streaming data |
| **Message Queues** | Apache Kafka, Amazon Kinesis | Event streams from applications |

---

### Source Systems Are Unpredictable

- **Systems go down** -- outages and failures
- **Change in format/schema of data** -- fields added, removed, or renamed
- **Change in data** -- content or quality shifts unexpectedly

---

### Ingestion

#### Frequency of Ingestion

| Pattern | Description | Trigger |
|---------|-------------|---------|
| **Batch** | Accumulated batches of data processed at intervals | Based on predetermined **time interval** or preset **size threshold** |
| **Streaming** | Continuous, near real-time ingestion | Data available **shortly after produced** |

#### Batch vs. Stream Considerations

| Factor | Batch | Streaming |
|--------|-------|-----------|
| **Time** | Delayed (minutes to hours) | Near real-time (< 1 second) |
| **Money** | Generally cheaper | More expensive infrastructure |
| **Maintenance** | Simpler to maintain | More complex operational burden |

#### Other Ingestion Dimensions

| Dimension | Options | Description |
|-----------|---------|-------------|
| **Direction** | Push / Pull | Source pushes or system pulls |
| **Change tracking** | CDC | Track row-level changes; only move changed data |

---

### Storage

#### Storage Hierarchy

```
+-------------------------------------+
|       Storage Abstractions           |  <-- Data Warehouse, Data Lake, Data Lakehouse
+-------------------------------------+
                 |
+-------------------------------------+
|       Storage Systems                |  <-- DBMS, Object Storage, Cache, Streaming
+-------------------------------------+
                 |
+-------------------------------------+
|       Raw Ingredients                |  <-- Physical: SSD, Magnetic disk, RAM
|                                      |      Process: Networking, Serialization,
|                                      |               CPU, Compression, Caching
+-------------------------------------+
```

#### Raw Hardware Ingredients

| Hardware | Characteristics | Cost |
|----------|----------------|------|
| **SSD** | Fast reads/writes, no moving parts | Baseline |
| **Magnetic disk** | Backbone of modern data storage; slower | **2-3x cheaper** than SSD |
| **RAM** | Fastest read/write speeds | **30-50x more expensive** than SSD; **volatile** |

#### Storage Abstractions

| Abstraction | Characteristics | Schema Strategy |
|-------------|----------------|-----------------|
| **Data Warehouse** | Structured; optimized for analytical queries | Schema-on-write |
| **Data Lake** | Raw data in all formats; flexible | Schema-on-read |
| **Data Lakehouse** | Combines Lake + Warehouse features | Supports both |

---

### Queries, Modeling, and Transformation

#### SQL Command Categories

| Category | Commands / Keywords |
|----------|-------------------|
| **Data Cleaning** | `DROP`, `TRUNCATE`, `TRIM`, `REPLACE`, `SELECT DISTINCT` |
| **Data Joining** | `INNER JOIN`, `LEFT JOIN`, `RIGHT JOIN`, `FULL JOIN`, `UNION` |
| **Data Aggregating** | `SUM`, `AVG`, `COUNT`, `MAX`, `MIN`, `GROUP BY` |
| **Data Filtering** | `WHERE`, `AND`, `OR`, `IS NULL`, `IS NOT NULL`, `IN`, `LIKE` |

#### Transformation Patterns

| Pattern | Flow | When to Use |
|---------|------|------------|
| **ETL** | Extract --> Transform --> Load | Transform before loading into warehouse |
| **ELT** | Extract --> Load --> Transform | Load raw data first; transform in the warehouse |

---

### Serving

- **Analytics & BI:** Tableau, Looker, Power BI -- dashboards and reports
- **Machine Learning:** Training data pipelines, feature stores
- **Reverse ETL:** Feed processed data back to operational systems

---

### Reverse ETL

```
CRM (Names, Contact Info, Form data)
    |
    v
Transform --> Storage --> Train lead-scoring model --> Output
                                                         |
                          <------------------------------+
                          (scores back into CRM)
```

---

### One-Way and Two-Way Door Decisions

| Decision Type | Definition | Example |
|---------------|-----------|---------|
| **One-way door** | **Almost impossible to reverse** | Choosing a foundational enterprise architecture |
| **Two-way door** | **Easily reversible** | Switching between S3 storage classes |

**Best practice:** Favor two-way door decisions wherever possible.

---

### The 6 Undercurrents

Undercurrents flow beneath ALL stages of the lifecycle simultaneously:

```
+--------------------------------------------------------------------------------+
| Security | Data Mgmt | DataOps | Data Architecture | Orchestration | Soft. Eng. |
+--------------------------------------------------------------------------------+
|       Generation --> Ingestion --> Transformation --> Serving                    |
|                                     Storage                                     |
+--------------------------------------------------------------------------------+
```

#### Undercurrent 1: Security

**Principle of Least Privilege:**
> "Give users or applications access to only the essential data and resources they need for **only the duration required**"

#### Undercurrent 2: Data Management

**11 Data Knowledge Areas (DAMA International)** centered around **Data Governance**.

**Data Quality:**

| High Quality Data | Low Quality Data |
|------------------|-----------------|
| Accurate | Inaccurate |
| Complete | Incomplete |
| Discoverable | Hard to find |
| Available in a timely manner | Late |
| Exactly what stakeholders expect | Unusable |

#### Undercurrent 3: DataOps

Applies DevOps principles to data engineering: Automation, Monitoring, Plan-Create-Deploy-Monitor-Improve cycle.

#### Undercurrent 4: Data Architecture

> "The design of systems to support the evolving data needs of an enterprise, achieved by **flexible and reversible decisions** reached through a careful evaluation of trade-offs"

#### Undercurrent 5: Orchestration

- **Apache Airflow** -- most widely used orchestration tool
- **DAGs** -- define pipeline dependencies and execution order

#### Undercurrent 6: Software Engineering

Version control, testing, CI/CD, code quality, documentation.

---

## C1 Week 3: Data Architecture

### Conway's Law

> "Any organization that designs a system will produce a design whose structure is a copy of the organization's communication structure." -- **Melvin Conway**

---

### 9 Principles of Good Data Architecture

| # | Principle | Grouping |
|---|-----------|----------|
| 1 | Choose common components wisely | Impact on teams |
| 2 | Plan for failure! | Unspoken priorities |
| 3 | Architect for Scalability | Unspoken priorities |
| 4 | Architecture is leadership | Impact on teams |
| 5 | Always be Architecting | Ongoing process |
| 6 | Build loosely coupled systems | Ongoing process |
| 7 | Make reversible decisions | Ongoing process |
| 8 | Prioritize Security | Unspoken priorities |
| 9 | Embrace FinOps | Unspoken priorities |

---

### Batch Architectures

```
Data Sources --> ETL or ELT --> Data Warehouse --> Data Marts
                                                        |
                                              +---------+---------+
                                              v         v         v
                                        Analytics   Machine    Reverse
                                        & Reports   Learning    ETL
```

---

### Streaming Architectures

| Pipeline Type | Latency | Mechanism |
|--------------|---------|-----------|
| **Batch** | Minutes--hours | Accumulate batches --> process |
| **Streaming** | **< 1 second** | Continuous near real-time ingestion |

---

### Architectural Patterns

#### Lambda Architecture

Two separate code paths (batch + stream); combined view in serving layer. Operationally complex.

#### Kappa Architecture

Single stream processing path; retains history for replay. Simpler than Lambda.

#### Unified Batch & Streaming

Same code for bounded + unbounded data. **Tools:** Google Dataflow, Apache Beam, Apache Flink.

---

### Architecting for Compliance

| Regulation | Region/Industry | Covers |
|-----------|----------------|--------|
| **GDPR** | EU (2018) | Personal data, PII, right to deletion |
| **HIPAA** | US Healthcare | Patient health information |
| **Sarbanes-Oxley** | US Financial | Corporate financial reporting |

**Strategy:** Use **loosely coupled components** so individual parts can be replaced for new regulations.

---

### Choosing Tools and Technologies

| Type | Description | Examples |
|------|------------|---------|
| **Open source** | Free; community-maintained | Apache Kafka, Airflow, dbt |
| **Managed open source** | Cloud-hosted open source | Amazon MSK |
| **Proprietary** | Licensed commercial | Snowflake, Databricks, Tableau |

---

## C1 Week 4: Bringing It All Together

### The Complete Mental Model

```
Source System Owners --> [4-Step Framework] --> [Lifecycle + Undercurrents] --> [9 Principles] --> End Users (value)
```

---

### Requirements Gathering

**Hierarchy of Needs:**

```
Business Goals --> Stakeholder Needs --> System Requirements (Functional + Nonfunctional)
```

---

### The Iron Triangle

```
              Timeline
                /\
               /  \
              /    \
          Scope -- Cost

Good, fast, or cheap: you only get to pick two!
```

**How to break it:** Loosely coupled components + two-way doors + stakeholder collaboration.

---

### AWS Services for Batch Pipelines

| Feature | Amazon EMR | AWS Glue ETL |
|---------|-----------|--------------|
| **Philosophy** | More control | More convenience |
| **Schema Discovery** | Manual | AWS Glue Crawler |
| **Pipeline Design** | Code-based | Visual ETL tool available |

---

### AWS Services for Streaming Pipelines

| Feature | Amazon MSK | Amazon Kinesis Data Streams |
|---------|-----------|---------------------------|
| **Philosophy** | More control | More convenience |
| **Use case** | Kafka clusters; high flexibility | User-friendly; reduced overhead |

**Amazon Data Firehose:** No custom code needed; 20+ AWS integrations; auto-delivers to S3, Redshift, Splunk, Datadog.

---

### AWS Lab: Recommender System

**Three parts:**
1. **Batch pipeline:** RDS --> Glue ETL --> S3 Data Lake --> Glue Crawler --> Recommender
2. **Vector database:** Item/user embeddings in RDS Vector DB
3. **Streaming pipeline:** Kinesis --> Firehose --> Lambda (transform + inference) --> S3 Recommendations

---

---

# Course 2 -- Source Systems, Data Ingestion, and Pipelines

## Complete Reference Notes

*Based on: Fundamentals of Data Engineering, Joe Reis & Matt Housley*

---

## Table of Contents -- Course 2

- [Week 1: Introduction to Source Systems](#c2-week-1-introduction-to-source-systems)
- [Week 2: Data Ingestion](#c2-week-2-data-ingestion)
- [Week 3: DataOps](#c2-week-3-dataops)
- [Week 4: Orchestration](#c2-week-4-orchestration)

---

## Course 2 Structure

| Week | Title | Core Topics |
|------|-------|------------|
| 1 | Introduction to Source Systems | Databases (relational, NoSQL), ACID, APIs, Object Storage, Logs, Streaming, IAM, Networking |
| 2 | Data Ingestion | Batch vs Streaming, ETL vs ELT, REST APIs, Kafka, Kinesis |
| 3 | DataOps | IaC, Terraform, Data Observability, Great Expectations, CloudWatch |
| 4 | Orchestration | Apache Airflow, DAGs, Operators, XCom, TaskFlow API, MWAA, Step Functions |

---

## C2 Week 1: Introduction to Source Systems

### Types of Source Systems

```
Source Systems
  |
  +-- Databases
  |     +-- Relational (MySQL, PostgreSQL, Oracle, SQL Server)
  |     +-- NoSQL (Key-Value, Document, Wide-Column, Graph)
  |
  +-- Files
  |     +-- Object Storage (Amazon S3)
  |     +-- Local file systems
  |
  +-- Event / Streaming Systems
        +-- Message Queues (Amazon SQS)
        +-- Event Streaming Platforms (Kafka, Kinesis)
```

### Data Types

| Type | Description | Examples |
|------|------------|---------|
| **Structured** | Organized in a predefined schema | Relational database tables, CSV files |
| **Semi-structured** | Has some organizational properties | JSON, XML, Avro, Parquet |
| **Unstructured** | No predefined data model | Images, videos, audio, free-form text |

### Relational Databases

- **Table (Relation):** Rows (records) and columns (attributes)
- **Schema:** Structure definition -- tables, columns, data types, constraints
- **Primary Key:** Uniquely identifies each row
- **Foreign Key:** References another table's primary key
- **Normalization:** Organizing data to reduce redundancy

### SQL Fundamentals

```sql
-- Query progression: SELECT -> columns -> LIMIT -> WHERE -> ORDER BY -> JOIN -> GROUP BY
SELECT c.name AS category, COUNT(*) AS film_count
FROM film f
JOIN film_category fc ON f.film_id = fc.film_id
JOIN category c ON fc.category_id = c.category_id
GROUP BY c.name
ORDER BY film_count DESC;
```

#### JOIN Types

| JOIN Type | Description |
|-----------|------------|
| **INNER JOIN** | Only matching rows in both tables |
| **LEFT JOIN** | All left + matching right |
| **RIGHT JOIN** | All right + matching left |
| **FULL JOIN** | All rows from both tables |

### CRUD Operations

| Operation | SQL Command |
|-----------|------------|
| **C**reate | `CREATE TABLE`, `INSERT INTO` |
| **R**ead | `SELECT` |
| **U**pdate | `UPDATE ... SET ... WHERE` |
| **D**elete | `DELETE FROM ... WHERE` |

### NoSQL Databases

| Type | Structure | Use Cases | Example |
|------|-----------|-----------|---------|
| **Key-Value** | Key maps to value | Caching, session data | Redis, DynamoDB |
| **Document** | JSON-like documents | Content management, IoT | MongoDB, DynamoDB |
| **Wide-Column** | Column families | Time-series, analytics | Cassandra, HBase |
| **Graph** | Nodes and edges | Social networks, fraud | Neo4j, Neptune |

### ACID Compliance

| Principle | Definition |
|-----------|-----------|
| **Atomicity** | All operations succeed or all fail |
| **Consistency** | Changes follow all rules and constraints |
| **Isolation** | Each transaction executed independently |
| **Durability** | Completed transactions are permanent |

### Object Storage

- **Immutable** objects in a flat namespace
- Each object has a **UUID** key and **metadata**
- Amazon S3: **99.999999999% durability** (11 nines)
- Use cases: data lake, ML training data, semi-structured/unstructured

### Logs

Append-only sequence of records ordered by time. Fields: Timestamp, User ID, Status, Action.

| Level | Description |
|-------|------------|
| **debug** | Detailed diagnostic info |
| **info** | General operational messages |
| **warn** | Potential issues |
| **error** | Errors preventing operation |
| **fatal** | Critical system failures |

### Streaming Systems

| Term | Definition |
|------|-----------|
| **Event** | Something that happened or a state change |
| **Message** | Record of information about an event |
| **Stream** | Sequence of messages |
| **Producer** | Generates and sends messages |
| **Consumer** | Receives and processes messages |

#### Message Queue vs Event Streaming Platform

| Feature | Message Queue | Event Streaming Platform |
|---------|--------------|------------------------|
| **Storage** | Temporary -- removed after consumption | Persistent -- retained for replay |
| **Replay** | Not possible | Possible |
| **AWS** | Amazon SQS | Amazon Kinesis |
| **Open-Source** | RabbitMQ | Apache Kafka |

### IAM and Permissions

| Identity Type | Description |
|--------------|------------|
| **Root User** | Unrestricted access |
| **IAM User** | Specific permissions via username/password or access key |
| **IAM Group** | Collection of users inheriting same permissions |
| **IAM Role** | Temporary permissions for user/application/service |

### Networking

- **VPC:** Isolated virtual network spanning multiple AZs
- **Public Subnet:** Internet-facing resources
- **Private Subnet:** Internal resources (databases)
- **ACL:** Controls traffic at subnet level
- **Internet Gateway:** Allows VPC to communicate with internet

---

## C2 Week 2: Data Ingestion

### Batch vs Streaming Ingestion

```
Batch                  Micro-batch              Streaming
  |------------------------|--------------------------|
Semi-Frequent            Frequent               Very frequent
```

### ETL vs ELT

| Pattern | Description |
|---------|------------|
| **ETL** | Transform before loading; limited storage scenarios |
| **ELT** | Load raw first, transform in destination; cheap scalable cloud storage |

**ELT risk:** Creating a **data swamp** -- raw, unorganized, undocumented data nobody can use.

### REST APIs and HTTP Methods

| Method | Description |
|--------|------------|
| **GET** | Retrieve data |
| **POST** | Create new data |
| **PUT** | Update existing data |
| **DELETE** | Remove data |

### Apache Kafka

```
Kafka Cluster (Brokers) --> Topics --> Partitions
    ^                                      |
    |                                      v
Event Producers                    Consumer Groups
```

| Concept | Description |
|---------|------------|
| **Cluster** | Multiple broker servers |
| **Topic** | Category for related events |
| **Partition** | Ordered, immutable sequence within a topic |
| **Consumer Group** | Consumers subscribing to topics; Kafka distributes partitions |

### Amazon Kinesis Data Streams

| Operation | Limit per Shard |
|-----------|----------------|
| **Write** | 1,000 records/s, max 1 MB/s |
| **Read** | 5 read ops/s, max 2 MB/s |

| Mode | Description |
|------|------------|
| **On-demand** | Auto-scaling, pay per use |
| **Provisioned** | You specify shard count |

---

## C2 Week 3: DataOps

### Three Pillars

```
            DataOps
           /   |    \
  Automation  Observability  Incident Response
  (IaC)       & Monitoring
```

### Terraform

Cloud-agnostic IaC tool using **HCL** (HashiCorp Configuration Language). **Idempotent** and declarative.

```
Write --> terraform init --> terraform plan --> Review --> terraform apply
```

### Data Observability

> A **system failure** (alerts, 404 errors) is the **best case**. The **worst case** is when data changes silently and the system continues producing **low quality data**.

### Data Quality Metrics

| Metric | What to Monitor |
|--------|----------------|
| **Volume** | Number of records per batch/interval |
| **Null Values** | Count of nulls in critical columns |
| **Distribution** | Range and distribution of values |
| **Freshness** | Time since most recent record |

**Avoid "Alert Fatigue":** Focus on the most important metrics driven by stakeholder requirements.

### Great Expectations

Open-source Python library for data validation. Workflow: Data Context --> Data Sources --> Expectations --> Checkpoints --> Validation Results.

### Amazon CloudWatch

| Metric Type | Examples |
|-------------|---------|
| **System Level** | CPU utilization, Disk I/O, Network, Memory |
| **Custom** | Transactions processed, API response time, Active users |

---

## C2 Week 4: Orchestration

### Apache Airflow

Open-source platform to programmatically author, schedule, and monitor workflows as **DAGs**.

#### Core Components

| Component | Description |
|-----------|------------|
| **Metadata Database** | Stores state of DAGs, tasks, variables, XCom |
| **Web Server** | UI for visualizing and managing workflows |
| **Scheduler** | Monitors DAGs, triggers tasks |
| **Workers** | Execute task logic |
| **DAG Directory** | Python files defining DAGs |
| **Executor** | Determines how tasks run |

#### Operators

| Operator | Description |
|----------|------------|
| **PythonOperator** | Executes a Python function |
| **BashOperator** | Executes a Bash command |
| **EmptyOperator** | Placeholder / join point |
| **EmailOperator** | Sends an email |
| **Sensor** | Waits for a condition |

### XCom (Cross-Communication)

Passes small data between tasks via Metadata Database. Use for metadata/dates/small metrics. Use S3 for large datasets.

### TaskFlow API

Modern approach using `@dag` and `@task` decorators instead of traditional DAG + PythonOperator.

| Aspect | Traditional | TaskFlow |
|--------|------------|----------|
| DAG creation | `with DAG(...) as dag:` | `@dag(...)` on a function |
| Task creation | `PythonOperator(task_id=..., python_callable=func)` | `@task` on a function |
| XCom | `xcom_push` / `xcom_pull` | `return` / function parameters |

### Orchestration on AWS

| Tool | Best For |
|------|----------|
| **Apache Airflow / MWAA** | Flexibility, complex workflows |
| **AWS Step Functions** | Serverless, AWS-centric workflows |
| **AWS Glue Workflows** | ETL-specific orchestration |

---

---

# Course 3 -- Data Storage and Queries

## Complete Reference Notes

*Based on: Fundamentals of Data Engineering, Joe Reis & Matt Housley*

---

## Table of Contents -- Course 3

- [Week 1: Storage Systems](#c3-week-1-storage-systems)
- [Week 2: Storage Abstractions](#c3-week-2-storage-abstractions)
- [Week 3: Queries](#c3-week-3-queries)

---

## Course 3 Structure

| Week | Title | Core Topics |
|------|-------|------------|
| 1 | Storage Systems | Storage hierarchy, physical components, serialization, compression, caching, cloud storage, DBMS, row vs column-oriented |
| 2 | Storage Abstractions | Data warehouse, CDC, MPP, cloud DW (Redshift, BigQuery, Snowflake), data lake, lakehouse, open table formats |
| 3 | Queries | Life of a query, EXPLAIN, indexes (B-Tree), advanced SQL (CTEs, subqueries, window functions), streaming queries |

---

## C3 Week 1: Storage Systems

### Storage Hierarchy

```
+------------------------------------------+
|         Storage Abstractions             |
|   [Data Warehouse] [Data Lake] [Lakehouse]|
+------------------------------------------+
|           Storage Systems                |
|  [RDBMS] [OLTP] [OLAP] [Cache] [...]    |
+------------------------------------------+
|           Raw Ingredients                |
|  Physical: HDD, SSD, RAM, CPU Cache     |
|  Processes: Networking, Serialization,   |
|     CPU, Compression, Caching            |
+------------------------------------------+
```

### Performance Comparison

| Component | Latency | Cost per GB | Persistent? |
|-----------|---------|-------------|-------------|
| **Magnetic Disk** | ~4 ms | $0.03--0.06 | Yes |
| **SSD** | ~0.1 ms | $0.08--0.10 | Yes |
| **RAM** | ~0.1 us | >$3.00 | No |
| **CPU Cache** | ~1 ns | N/A | No |

### Serialization Formats

#### Human-Readable

| Format | Type | Characteristics |
|--------|------|----------------|
| **CSV** | Row-based | Simple; no schema; no type enforcement |
| **XML** | Tag-based | Hierarchical; verbose; supports schema validation |
| **JSON** | Key-value | Lightweight; nested; widely used in APIs |

#### Binary

| Format | Orientation | Key Features |
|--------|------------|-------------|
| **Apache Parquet** | Column-based | Excellent for analytics; efficient compression |
| **Apache Avro** | Row-based | Embedded schema; schema evolution; good for streaming |

### Cloud Storage Options

| File Storage | Block Storage | Object Storage |
|-------------|--------------|----------------|
| Directory tree hierarchy | Fixed-size blocks on disk | Immutable objects, flat structure |
| Data sharing, easy management | Transactional workloads, low latency | Analytical queries, high scalability |
| **Amazon EFS** | **Amazon EBS** | **Amazon S3** |

### Row-Oriented vs Column-Oriented Databases

| Aspect | Row-Oriented | Column-Oriented |
|--------|-------------|----------------|
| **Best for** | OLTP (transactional) | OLAP (analytical) |
| **Read pattern** | Efficient for entire rows | Efficient for specific columns across many rows |
| **Compression** | Less compressible | Highly compressible |
| **Examples** | MySQL, PostgreSQL | Redshift, BigQuery, Snowflake |

---

## C3 Week 2: Storage Abstractions

### Data Warehouse (Bill Inmon)

| Property | Meaning |
|----------|---------|
| **Subject-Oriented** | Organized around business subjects |
| **Integrated** | Consolidated from multiple sources |
| **Nonvolatile** | Stable once loaded |
| **Time-Variant** | Stored with time dimension |

### Change Data Capture (CDC)

Tracks row-level changes in source databases; enables incremental loading and near real-time sync.

### Modern Cloud Data Warehouses

| Platform | Key Features |
|----------|-------------|
| **Amazon Redshift** | MPP; columnar; Redshift Spectrum for S3 |
| **Google BigQuery** | Serverless; auto-scaling; pay-per-query |
| **Snowflake** | Multi-cloud; virtual warehouses; time travel |

### Data Lake

Central repository storing data in native format; schema-on-read. Built on low-cost object storage.

#### Data Lake 1.0 Shortcomings

Data swamp, write-only storage, no schema management, no ACID, poor quality.

### Data Zones

```
Landing/Raw --> Cleaned/Transformed --> Curated/Enriched --> Analytics/ML
```

### Data Lakehouse

Combines low-cost lake storage with warehouse query performance. Enabled by **open table formats:**

| Format | Origin |
|--------|--------|
| **Apache Iceberg** | Netflix |
| **Delta Lake** | Databricks |
| **Apache Hudi** | Uber |

---

## C3 Week 3: Queries

### Life of a Query

```
Client --> Transport System --> Parser --> Optimizer --> Execution Engine --> Storage Engine
```

### EXPLAIN

Shows the execution plan without executing:

| Field | Meaning |
|-------|---------|
| **Startup cost** | Cost before first row returned |
| **Total cost** | Total cost for all rows |
| **Rows** | Estimated rows returned |
| **Width** | Average row width in bytes |

### Index Deep Dive (B-Tree)

```
Root Node --> Branch Nodes --> Leaf Nodes (data + pointers, doubly linked)
```

| Aspect | Sequential Scan | Index Scan |
|--------|----------------|------------|
| **How** | Reads every row | Uses B-Tree to locate matches |
| **Best for** | Small tables; most rows returned | Large tables; few rows returned |
| **Trade-off** | No write overhead | Index must be maintained on writes |

### Advanced SQL

#### CTEs (Common Table Expressions)

```sql
WITH cte_name AS (
    SELECT ... FROM ... WHERE ...
)
SELECT ... FROM cte_name;
```

CTEs can be chained -- one CTE references another.

#### Subqueries

```sql
SELECT film_id FROM dim_film
WHERE length > (SELECT AVG(length) FROM dim_film);
```

#### Window Functions

```sql
SELECT customer_id, name, average_rental_days,
    rank() OVER (PARTITION BY customer_id ORDER BY average_rental_days DESC) AS rank_category
FROM customer_info
```

| Function | Behavior with Ties |
|----------|-------------------|
| `rank()` | Same rank; skips subsequent (1, 1, 3) |
| `row_number()` | Different ranks; no skipping (1, 2, 3) |

---

---

# Course 4 -- Data Modeling, Transformation, and Serving

## Complete Reference Notes

*Based on: Fundamentals of Data Engineering, Joe Reis & Matt Housley*

---

## Table of Contents -- Course 4

- [Week 1: Data Modeling for Analytics](#c4-week-1-data-modeling-for-analytics)
- [Week 2: Data Modeling and Transformation for ML](#c4-week-2-data-modeling-and-transformation-for-ml)
- [Week 3: Data Transformations](#c4-week-3-data-transformations)
- [Week 4: Serving Data](#c4-week-4-serving-data)

---

## Course 4 Structure

| Week | Title | Core Topics |
|------|-------|------------|
| 1 | Data Modeling for Analytics | Star Schema, Inmon vs Kimball, Data Vault, OBT, Surrogate keys, dbt |
| 2 | Data Modeling for ML | Text pre-processing, BoW, TF-IDF, Word/Sentence Embeddings, Tabular data, Image data |
| 3 | Data Transformations | ETL/ELT/EtLT, CDC, Hadoop/MapReduce, Spark, EMR, Streaming |
| 4 | Serving Data | BI/Operational/Embedded Analytics, Semantic Layer, Views, Materialized Views, Capstone |

---

## C4 Week 1: Data Modeling for Analytics

### Star Schema

| Component | Description |
|-----------|-------------|
| **Fact Table** | Quantitative, measurable data (central table) |
| **Dimension Table** | Descriptive, contextual attributes (surround fact) |

```
    dim_stores           fact_order_items         dim_date
   +----------+        +------------------+      +--------+
   |store_key |------->|fact_order_key    |<-----|date_key|
   |store_id  |        |order_id          |      |month   |
   |store_name|        |store_key (FK)    |      |year    |
   +----------+        |item_key (FK)     |      +--------+
                       |date_key (FK)     |
    dim_items          |item_quantity     |
   +----------+        |item_price        |
   |item_key  |------->+------------------+
   |sku       |
   |name      |
   +----------+
```

### Star Schema vs 3NF

| Aspect | Star Schema | 3NF |
|--------|-------------|-----|
| **Joins** | Fewer | Many |
| **Redundancy** | Some duplication | Minimal |
| **Use case** | Read-heavy analytics | Write-heavy transactions |

### Inmon vs Kimball

| Criterion | Inmon | Kimball |
|-----------|-------|---------|
| **Approach** | Top-down (enterprise-first) | Bottom-up (business process-first) |
| **Normalization** | Highly normalized (3NF) | Denormalized (star schemas) |
| **Speed** | Slower initial delivery | Faster initial delivery |
| **Best for** | Large enterprises, single source of truth | Fast analytics delivery |

### 4-Step Conversion: Normalized to Star Schema

1. **Select the business process** (e.g., order processing)
2. **Declare the grain** (e.g., individual order line item)
3. **Identify the dimensions** (who, what, where, when)
4. **Identify the facts** (quantities, amounts, counts)

**Surrogate Keys:** Artificial keys (MD5 hash of business key) decoupling warehouse from source system changes.

### Data Vault

| Component | Purpose | Contains |
|-----------|---------|----------|
| **Hubs** | Core business entities | Hash key, business key, load date, record source |
| **Links** | Relationships between hubs | Hash key, foreign hash keys, load date, record source |
| **Satellites** | Descriptive attributes (change over time) | Parent hash key + load date (composite PK), attributes |

**Insert-only** approach. Full auditability. Handles changing source systems.

### One Big Table (OBT)

Single highly denormalized table. Can have hundreds of columns with nested data. No joins needed.

| Pros | Cons |
|------|------|
| Low cost cloud storage | Lose business logic in analytics |
| Columnar storage optimizes wide tables | Complex nested data structures |
| Reading nulls is free in columnar | Poorer update/aggregation performance |

### dbt for Data Modeling

SQL-based transformation tool. Wraps SELECT statements with CREATE TABLE/VIEW. Transforms normalized staging into star schemas.

---

## C4 Week 2: Data Modeling and Transformation for ML

### Text Processing Pipeline

| Step | Description |
|------|-------------|
| 1. **Cleaning** | Remove HTML tags, special characters |
| 2. **Normalization** | Lowercase, standardize formats |
| 3. **Tokenization** | Split into individual words |
| 4. **Stop Word Removal** | Remove common low-meaning words |
| 5. **Lemmatization** | Reduce to base/root form |

### Text Vectorization

| Method | Description |
|--------|------------|
| **Bag of Words** | Vector of word counts; ignores order |
| **TF-IDF** | Weighs by importance; frequent in doc but rare across corpus |

### Embeddings

| Model | Type | Provider |
|-------|------|----------|
| **word2vec** | Word | Google |
| **GloVe** | Word | Stanford |
| **SBERT** | Sentence | Sentence-Transformers |
| **OpenAI Embeddings** | Sentence | OpenAI |

### Tabular Data Transformations

| Transformation | Purpose |
|----------------|---------|
| **Imputation** | Handle missing values |
| **Encoding** | Convert categorical to numbers |
| **Scaling** | Normalize numeric features |

### Image Data for ML

| Approach | Transformations |
|----------|----------------|
| **Classical ML** | Reshape, normalize pixels, manual feature extraction |
| **CNNs** | Resize, normalize, data augmentation (rotation, flip, crop) |

---

## C4 Week 3: Data Transformations

### ETL vs ELT vs EtLT

| Pattern | Flow | Tool Examples |
|---------|------|---------------|
| **ETL** | Extract -> Transform -> Load | AWS Glue ETL |
| **ELT** | Extract -> Load -> Transform (in warehouse) | dbt |
| **EtLT** | Extract -> light transform -> Load -> heavy transform | Glue + dbt |

### CDC Patterns

#### Capturing Updates

| Strategy | History | Table Growth |
|----------|---------|-------------|
| **Insert-only** | Full history preserved | Grows continuously |
| **Upsert/Merge** | Only latest state | Manageable |

#### Capturing Deletes

| Strategy | History |
|----------|---------|
| **Hard delete** | Lost |
| **Soft delete** | Preserved (boolean flag) |
| **Insert-only** | Full history with timestamps |

### HDFS

```
NameNode (metadata catalog) --> DataNodes (store blocks + compute)
```

Combines compute and storage on same nodes. Replication for durability.

### MapReduce

| Phase | Action |
|-------|--------|
| **Map** | Produce key-value pairs from local data |
| **Shuffle** | Redistribute by key across cluster |
| **Reduce** | Aggregate values per key |

**Limitation:** Reads/writes to disk between steps (high I/O overhead).

### Apache Spark

- Retains intermediate results **in memory** (RAM)
- Supports SQL, ML, Streaming, Graph processing
- **Lazy evaluation:** Transformations recorded, executed only on actions

```
Driver Node (Spark Session) --> Cluster Manager --> Worker Nodes (Executors)
```

#### Spark DataFrames vs pandas

| Criterion | Spark | pandas |
|-----------|-------|--------|
| **Framework** | Distributed (cluster) | Single machine |
| **When to use** | Data doesn't fit in memory | Data fits in memory |
| **Scaling** | Horizontal (add nodes) | Vertical (add RAM) |

### Amazon EMR

Managed elastic clusters for Hadoop, Spark, Hive, Flink, Presto, HBase. Decouples compute and storage via S3.

### Streaming Transformations

| Type | Description |
|------|-------------|
| **Enrich** | Add context data to each event |
| **Join** | Combine two event streams |
| **Windowed** | Aggregate over time windows |

| Approach | Framework | Latency |
|----------|-----------|---------|
| **Microbatch** | Spark Streaming | Moderate (up to 2 min) |
| **True stream** | Apache Flink | Sub-second |

---

## C4 Week 4: Serving Data

### Analytics Use Cases

| Use Case | Description |
|----------|-------------|
| **Business Intelligence** | Dashboards and reports for decision-making |
| **Operational Analytics** | Real-time monitoring of processes |
| **Embedded Analytics** | Analytics integrated into customer-facing apps |

### The Semantic Layer

Abstraction providing consistent data definitions, data logic, and business metrics on top of physical data. Created in BI tools (Looker LookML) or dbt.

### Views vs Materialized Views

| Feature | View | Materialized View |
|---------|------|-------------------|
| **Storage** | None (virtual) | Pre-computed and stored |
| **Freshness** | Always current | Stale until refreshed |
| **Query speed** | Slower (re-executes) | Faster (reads stored) |
| **Use case** | Access control, simplification | Expensive aggregations, dashboards |

### Capstone Lab -- DE Ftunes

End-to-end pipeline for a music streaming service:

**Data Sources:** Users API (JSON), Sessions API (JSON), Songs DB (PostgreSQL CSV)

**Star Schema:**
- `fact_order_items` -- session_id, song_id, price, liked
- `dim_users` -- user_id, name, country_code
- `dim_songs` -- song_id, title, duration, year
- `dim_artists` -- artist_id, name, familiarity, hottness
- `dim_date` -- date_key, month, year, day_of_week

**Architecture:** S3 (landing/transform zones) --> Glue Data Catalog --> Redshift Spectrum --> Redshift (serving) --> dbt (star schema) + Terraform (IaC) + Airflow (orchestration)

---

---

# Program-Wide Quick Reference

## Data Engineering Lifecycle

```
Generation --> Ingestion --> Transformation --> Serving --> Analytics / ML

Storage (underpins all stages)

Undercurrents: Security | Data Management | DataOps | Data Architecture | Orchestration | Software Engineering
```

## 4-Step Framework (Cycle)

```
1. Identify business goals & stakeholder needs
2. Define system requirements (functional + nonfunctional)
3. Choose tools & technologies
4. Build, evaluate, iterate & evolve --> loop back to 1
```

## 9 Principles of Good Data Architecture

1. Choose common components wisely
2. Plan for failure!
3. Architect for Scalability
4. Architecture is leadership
5. Always be Architecting
6. Build loosely coupled systems
7. Make reversible decisions
8. Prioritize Security
9. Embrace FinOps

## Data Modeling Approaches

| Approach | Structure | Creator | Best For |
|----------|-----------|---------|----------|
| **Inmon** | Normalized 3NF | Bill Inmon | Enterprise single source of truth |
| **Kimball** | Star schemas | Ralph Kimball | Fast analytics delivery |
| **Data Vault** | Hubs/Links/Satellites | Dan Linstedt | Changing sources, auditability |
| **One Big Table** | Single wide table | N/A | Simple queries, columnar storage |

## Streaming Architecture Patterns

| Pattern | Code Paths | Key Trait |
|---------|-----------|-----------|
| **Lambda** | Two (batch + stream) | Combined view; complex |
| **Kappa** | One (stream only) | Simpler; replay from stream |
| **Unified** | One (handles both) | Apache Beam/Flink |

## Storage Abstractions

| Abstraction | Schema | Best For |
|-------------|--------|----------|
| **Data Warehouse** | Schema-on-write | Structured analytics, BI |
| **Data Lake** | Schema-on-read | Raw data, ML, big data |
| **Data Lakehouse** | Both | Combined analytics + ML |

## Key AWS Services

| Service | Category | Purpose |
|---------|----------|---------|
| **Amazon S3** | Storage | Data lake, ML artifacts, object storage |
| **Amazon RDS** | Database | Relational DB, source system, vector DB |
| **Amazon Redshift** | Warehouse | Columnar MPP analytics |
| **Amazon DynamoDB** | NoSQL | High-throughput key-value |
| **AWS Glue** | ETL | Serverless ETL + Crawler + Data Catalog |
| **Amazon Kinesis** | Streaming | Real-time data streams |
| **Amazon MSK** | Streaming | Managed Kafka |
| **Amazon Data Firehose** | Streaming | Auto-deliver to S3/Redshift/Splunk |
| **Amazon EMR** | Processing | Managed Hadoop/Spark clusters |
| **Amazon Athena** | Query | Serverless SQL over S3 |
| **AWS Lambda** | Compute | Serverless functions (15-min timeout) |
| **Amazon EC2** | Compute | VMs with full control |
| **Amazon VPC** | Networking | Isolated private network |
| **AWS IAM** | Security | Identity and access management |
| **Amazon CloudWatch** | Monitoring | Metrics, logs, alarms |
| **Amazon MWAA** | Orchestration | Managed Apache Airflow |
| **AWS Step Functions** | Orchestration | Serverless state machines |
| **AWS Lake Formation** | Governance | Data lake access control |

## Key Tools

| Tool | Category | Description |
|------|----------|-------------|
| **Apache Airflow** | Orchestration | DAG-based workflow scheduling |
| **Apache Kafka** | Streaming | Event streaming platform |
| **Apache Spark** | Processing | In-memory distributed computing |
| **Apache Flink** | Streaming | True stream processing |
| **dbt** | Transformation | SQL-based ELT within warehouse |
| **Terraform** | IaC | Cloud-agnostic infrastructure provisioning |
| **Great Expectations** | Data Quality | Python data validation library |

---

*Reference text: Fundamentals of Data Engineering, Joe Reis & Matt Housley*
*Program: DeepLearning.AI Data Engineering Professional Certificate (Courses 1--4)*
