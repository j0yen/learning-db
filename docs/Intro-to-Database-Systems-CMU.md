# CMU 15-445/645: Introduction to Database Systems (Fall 2025)

**Instructor:** Andy Pavlo
**Institution:** Carnegie Mellon University
**URL:** https://15445.courses.cs.cmu.edu/fall2025/

---

# Part 1: Fundamentals & Storage (Lectures 1-8)

---

## Lecture 1: Relational Model & Algebra

*Source: 01-relationalmodel.pdf*

### 1. Databases

A database is an organized collection of inter-related data that models some aspect of the real-world (e.g modeling the students in a class or a digital music store). Databases are the core component of most computer applications. Computer Science is essentially taking in some input, performing some operations, and then producing the output, which can be seen as a database on a high level as well.

People often confuse "databases" with "database management systems" (e.g. MySQL, Oracle, MongoDB, Snowflake). A database management system (DBMS) is the software that manages a database. Among many things, a DBMS is responsible for inserting, deleting, and retrieving data from a database.

### 2. Flat File Strawman

Consider that we want to store data for a music store like Spotify. We want to hold information about the artists and which albums those artists have released. This database has two entities: an Artists entity and an Albums entity.

We choose to store the database's records as comma-separated value (csv) files that the DBMS manages, and each entity is stored in its own file (an artists.csv and albums.csv).

In this example, artists each have a name, year, and country attribute. Albums have name, artist, and year attributes.

The application has to parse these files each time it wants to read or update any records.

**Issues with Flat Files:**

- **Data Integrity:** How do we ensure that the artist is the same for each album entry? What if somebody overwrites the album year with an invalid string? What if there are multiple artists on an album? What happens if we delete an artist that has albums?
- **Implementation:** How do you find a particular record? What if we now want to create a new application that uses the same database? What if that application is running on a different machine? What if two threads try to write to the same file at the same time?
- **Durability:** What if the machine crashes while our program is updating a record? What if we want to replicate the database on multiple machines for high availability? Some database systems will sacrifice safety and durability by default to make database operations appear faster.

### 3. Database Management System

A DBMS is software that allows applications to store and analyze information in a database.

A general-purpose DBMS is designed to allow the definition, creation, querying, update, and administration of databases in accordance with some data model.

A data model is a collection of concepts for describing the data in database. Some examples include: Relational (most common), NoSQL (key/value, document, graph), Array / Matrix / Vector (for machine learning).

A schema is a description of a particular collection of data using a given data model. This defines the structure of data for a data model. Otherwise, you have random bits with no meaning.

**Common Data Models:**

- Relational (Most DBMSs)
- Key/Value (Simple Apps/Caching)
- Graph (NoSQL)
- Document/XML/Object (NoSQL)
- Wide-Column/Column-family (NoSQL)
- Array / Matrix / Vector (Machine Learning/Science)
- Hierarchical (Obsolete/Legacy/Rare)
- Network (Obsolete/Legacy/Rare)
- Multi-Value (Obsolete/Legacy/Rare)

**Early DBMSs:** In the late 1960s, early DBMSs required developers to write queries using procedural code (e.g. IDS, IMS, CODASYL). The developers had to choose access paths and execution ordering based on the current database contents. So, if the data changes, then the developer must rewrite the query code.

### 4. Relational Model

Ted Codd at IBM Research in the late 1960s noticed that people were rewriting DBMSs every time they wanted to change the physical layer. In 1969, he proposed the relational model as a potential solution to this.

**Three Key Concepts:**

- **Structure:** The definition of relations and their contents independent of their physical representation. Each relation has a set of attributes. Each attribute has a domain of values.
- **Integrity:** Ensure the database's contents satisfy certain constraints. An example of a constraint would be that the age of a person cannot be a negative number.
- **Manipulation:** Declarative API for accessing and modifying a database's contents via relations(sets). Programmers only specify the desired result; the database system will decide the most efficient query plan to execute.

**Key Definitions:**

- **Relation:** An unordered set that contains the relationship of attributes that represent entities. Since the relationships are unordered, the DBMS can store them in any way it wants, allowing for optimization. It is possible to have repeated/duplicated elements in a relation as long as their primary key is different.
- **Tuple:** A set of attribute values (also known as its domain) in the relation. In the past, values had to be atomic or scalar, but now values can also be lists or nested data structures. Every attribute can be a special value, NULL, which means for a given tuple the attribute is undefined.
- **N-ary Relation:** A relation with n attributes is called an n-ary relation. An n-ary relation is equivalent to a table with n columns.
- **Primary Key:** A relation's primary key uniquely identifies a single tuple in a table. Some DBMSs automatically create an internal primary key if you do not define one. It can auto-generate unique primary keys via an identity column.
- **Foreign Key:** A foreign key specifies that an attribute from one relation maps to a tuple in another relation. Generally, the foreign key will point/be equal to a primary key in another table.
- **Constraint:** A user-defined condition that must hold for any instance of the database. Unique key and referential (foreign key) constraints are the most common.

### 5. Data Manipulation Languages (DMLs)

DMLs refer to the API that a DBMS exposes to applications to store and retrieve information from a database. There are two classes of languages for Manipulating a database:

- **Procedural:** The query specifies the (high-level) execution strategy the DBMS should use to find the desired result based on sets/bags. For example, use a for loop to scan all records and count how many records are there to retrieve the number of records in the table.
- **Non-Procedural (Declarative):** The query specifies only what data is wanted and not how to find it. For example, we can use SQL `SELECT COUNT(*) FROM artist` to count how many records are there in the table.

### 6. Relational Algebra

Relational Algebra is a set of fundamental operations to retrieve and manipulate tuples in a relation. Each operator takes in one or more relations as inputs, and outputs a new relation. To write queries we can 'chain' these operators together.

| Operation | Description | Syntax | SQL Equivalent |
|---|---|---|---|
| Select | Subset of tuples satisfying a predicate | σ_predicate(R) | `SELECT * FROM R WHERE a_id = 'a2'` |
| Projection | Relation with only specified attributes | π_A1,A2(R) | `SELECT b_id-100, a_id FROM R WHERE a_id = 'a2'` |
| Union | All tuples in at least one input relation | (R ∪ S) | `(SELECT * FROM R) UNION ALL (SELECT * FROM S)` |
| Intersection | All tuples in both input relations | (R ∩ S) | `(SELECT * FROM R) INTERSECT (SELECT * FROM S)` |
| Difference | Tuples in first but not second relation | (R − S) | `(SELECT * FROM R) EXCEPT (SELECT * FROM S)` |
| Product | All possible tuple combinations | (R × S) | `SELECT * FROM R, S` |
| Join | Combined tuples matching on shared attributes | (R ⋈ S) | `SELECT * FROM R JOIN S USING (ATTR1, ATTR2)` |

**Key Observation:** Relational algebra defines the fundamental operations to retrieve and manipulate tuples in a relation. It also defines an ordering of the high-level steps to compute a query. In SQL (a declarative language) we only express what we want to be computed and we do not specify how to compute the result. The DBMS is responsible for finding the best strategy to execute the query (through Query Optimization).

### 7. Other Data Models

- **Document Data Model:** A collection of record documents containing a hierarchy of named field/value pairs. A field's value can be either a scalar type, an array of values, or a pointer to another document. Modern implementations use JSON. Older systems use XML or custom object representations.
- **Vector Data Model:** Represents one-dimensional arrays used for nearest-neighbor search (exact or approximate). Vector databases are generally used for semantic search on embeddings generated by ML-trained transformer models (think ChatGPT), and native integration with modern ML tools and APIs (e.g., LangChain, OpenAI). At their core, these systems use specialized indexes to perform NN searches quickly. Recently, many relational DBMSs have shipped vector index features or extensions (pgvector) that allow NN search within the relational model.

---

## Lecture 2: Modern SQL

*Source: 02-modernsql.pdf*

### 1. SQL History

SQL is a declarative query language for relational databases. As opposed to imperative languages, in a declarative language the programmer/user only declares what needs to be done as opposed to how the operations should be done (e.g. Join these two tables). SQL was originally developed in the 1970s as part of the IBM System R project. IBM originally called it "SEQUEL" (Structured English Query Language). The name changed in the 1980s to just "SQL" (Structured Query Language).

The minimum language syntax a system needs to support in order to claim that it supports SQL is SQL-92. Each vendor follows the standard to a certain degree and there are many proprietary extensions.

**Major Updates:**

| Version | Features |
|---|---|
| SQL:1999 | Regular Expressions, Triggers |
| SQL:2003 | XML, Windows, Sequences |
| SQL:2008 | Truncation, Fancy Sorting |
| SQL:2011 | Temporal DBs, Pipelined DML |
| SQL:2016 | JSON, Polymorphic tables |
| SQL:2023 | Property Graph Queries, Multi-Dimensional Arrays |

### 2. Relational Languages

The language is comprised of different classes of commands:

- **Data Manipulation Language (DML):** SELECT, INSERT, UPDATE, and DELETE statements.
- **Data Definition Language (DDL):** Schema definitions for tables, indexes, views, and other objects.
- **Data Control Language (DCL):** Security and access controls.

**Sets vs. Bags:** Relational algebra (which is the algebra that SQL is based on) uses sets (unordered collections which do not allow duplicates). However, SQL is based on bags (unordered collections which allow duplicates) to avoid the extra work of removing duplicates by default. Duplicates can still be removed via features like the DISTINCT keyword.

### 3. Example Database

```sql
CREATE TABLE student (
  sid INT PRIMARY KEY,
  name VARCHAR(16),
  login VARCHAR(32) UNIQUE,
  age SMALLINT,
  gpa FLOAT
);

CREATE TABLE course (
  cid VARCHAR(32) PRIMARY KEY,
  name VARCHAR(32) NOT NULL
);

CREATE TABLE enrolled (
  sid INT REFERENCES student (sid),
  cid VARCHAR(32) REFERENCES course (cid),
  grade CHAR(1)
);
```

### 4. Aggregates

An aggregation function takes in a bag of tuples as its input and then produces a single scalar value as its output. Aggregate functions can (almost) only be used in a SELECT output list.

**Functions:**

- `AVG(COL)`: The average of the values in COL
- `MIN(COL)`: The minimum value in COL
- `MAX(COL)`: The maximum value in COL
- `SUM(COL)`: The sum of the values in COL
- `COUNT(COL)`: The number of tuples in the relation

Some aggregate functions (e.g. COUNT, SUM, AVG) support the DISTINCT keyword.

**GROUP BY:** Non-aggregated values in SELECT output clause must appear in the GROUP BY clause. This will partition the tuples based off of the value and calculate the aggregates for each subset.

**Grouping Sets:** Can be used to specify multiple groupings in a single query rather than using UNION on multiple queries. This results in the DBMS needing to only scan through the data once rather than multiple times.

**HAVING:** The HAVING clause filters output results based on aggregation computation (i.e. filters out groups as opposed to filtering rows which is what the WHERE clause does). This makes HAVING behave like a WHERE clause for a GROUP BY.

### 5. String Operations

The SQL standard says that strings are case sensitive and single-quotes only. Real-world systems will vary in how loose they are about both points (e.g. MySQL).

**Pattern Matching:** The LIKE keyword is used for string matching in predicates. `%` matches any substrings (including empty). `_` matches any one character. SIMILAR TO allows for regular expression matching but it is not supported across all systems.

**String Functions:** SQL-92 defines string functions. Many database systems implement other functions in addition to those in the standard. Examples include `SUBSTRING(S, B, E)` and `UPPER(S)`.

**Concatenation:** Two vertical bars (`||`) will concatenate two or more strings together into a single string (but different systems might use a different symbol).

### 6. Date and Time

Databases generally want to keep track of dates and time, so SQL supports operations to manipulate DATE and TIME attributes. These can be used as either outputs or predicates. Specific syntax for date and time operations can vary wildly across systems.

### 7. Output Redirection

Instead of having the result a query returned to the client (e.g., terminal), you can tell the DBMS to store the results into another table. You can then access this data in subsequent queries.

- **New Table:** Store the output of the query into a new (permanent) table. Example: `SELECT DISTINCT cid INTO CourseIds FROM enrolled;`
- **Existing Table:** Store the output of the query into a table that already exists in the database. The target table must have the same number of columns with the same types as the target table, but the names of the columns in the output query do not have to match. Example: `INSERT INTO CourseIds (SELECT DISTINCT cid FROM enrolled);`

### 8. Output Control

Since results SQL are unordered, we must use the ORDER BY clause to impose a sort on tuples. The default sort order is ascending (ASC). We can manually specify DESC to reverse the order. We can use multiple ORDER BY clauses to break ties or do more complex sorting.

By default, the DBMS will return all of the tuples produced by the query. Many systems provide their own syntax for specifying how to get a set number of the first results from the output, but a common one is the LIMIT clause. We can also provide an offset to return a range in the results.

Unless we use an ORDER BY clause with a LIMIT, the DBMS may produce different tuples in the result on each invocation of the query because the relational model does not impose an ordering.

### 9. Window Functions

A window function performs 'sliding' calculation across a set of tuples that are related. Window functions are similar to aggregations, but tuples are not collapsed into a singular output tuple.

**Conceptual Execution:**

1. The table is partitioned
2. Each partition is sorted (if there is an ORDER BY clause)
3. For each record, it creates a window spanning multiple records
4. Finally the output is computed for each window

**Special Functions:**

- `ROW_NUMBER`: The number of the current row.
- `RANK`: The order position of the current row.

**Grouping:** The OVER clause specifies how to group together tuples when computing the window function. Use PARTITION BY to specify group.

**Important:** The DBMS computes RANK after the window function sorting, whereas it computes ROW_NUMBER before the sorting.

### 10. Nested Queries

Nested queries invoke queries inside of other queries to execute more complex logic within a single query. Nested queries are often difficult to optimize.

The scope of the outer query is included in an inner query (i.e. the inner query can access attributes from outer query). The opposite is not true.

**Locations:** SELECT Output Targets, FROM Clause, WHERE Clause.

**Result Expressions:**

- `ALL`: Must satisfy expression for all rows in sub-query.
- `ANY`: Must satisfy expression for at least one row in sub-query.
- `IN`: Equivalent to =ANY().
- `EXISTS`: At least one row is returned.

### 11. Lateral Joins

The LATERAL operator allows a nested query to reference attributes in other nested queries that precede it. You can think of lateral joins like a for loop that allows you to invoke another query for each tuple in a table.

### 12. Common Table Expressions

Common Table Expressions (CTEs) are an alternative to windows or nested queries when writing more complex queries. They provide a way to write auxiliary statements for use in a larger query. A CTE can be thought of as a temporary table that is scoped to a single query.

The WITH clause binds the output of the inner query to a temporary table with the same name. We can bind output columns to names before the AS. A single query may contain multiple CTE declarations.

Adding the RECURSIVE keyword after WITH allows a CTE to reference itself. This enables the implementation of recursion in SQL queries. With recursive CTEs, SQL is provably Turing-complete, implying that it is as computationally expressive as more general purpose programming languages.

---

## Lecture 3: Database Storage (Part I)

*Source: 03-storage1.pdf*

### 1. Storage

In this class, we focus on a 'disk-oriented' DBMS architecture that assumes that the primary storage location of the database is on non-volatile disk(s).

At the top of the storage hierarchy, you have the devices that are closest to the CPU. This is the fastest storage, but it is also the smallest and most expensive. The further you get away from the CPU, the larger but slower the storage devices get. These devices also get cheaper per GB.

There's also a demarcation line in the middle of the hierarchy that separates volatile devices from non-volatile devices.

**Volatile Devices:**

- Volatile means that the device does not retain its state after power loss. Therefore, the data that is stored in such devices can be lost.
- Volatile storage supports fast random access with byte-addressable locations. This means that the program can jump to any byte address and get the data that is there (e.g. in DRAM).
- For our purposes, we will always refer to this volatile storage class as 'memory.'

**Non-Volatile Devices:**

- Non-volatile devices do retain their state even when the machine/computer is off or power loss occurs. Therefore, the data that these devices store can be retrieved even after the machine/computer shuts down and restarts (e.g. disk).
- Non-Volatile devices are block/page addressable. This means that in order to read a value at a particular offset (byte), the program first has to load the 4 KB page into memory that holds the value that the program wants to read.
- Non-volatile storage is traditionally better at sequential access (reading contiguous blocks of data because of its architecture e.g. magnetic hard drive).
- We will refer to this as 'disk.' We will not make a (major) distinction between solid-state storage (SSD) and spinning hard drives (HDD).

### 2. Access Time and Access Pattern

There is a large contrast between latencies accessing volatile vs. non-volatile devices. In order to better understand the orders of magnitude of latency difference, suppose that reading data from the L1 cache reference took one second, then reading from an SSD would take 4.4 hours, and reading from an HDD would take 3.3 weeks.

There are two major access patterns, random access and sequential access. On real-world hardware the differences between their access latencies are significant. Random access on non-volatile storage is almost always slower than sequential access. The DBMS will always target maximizing sequential access, some systems will avoid blocking on random writes by writing sequentially into a buffer and later perform random disk writes in the background.

### 3. System Design Goals

A design goal of the disk-oriented DBMS is to allow it to manage databases that exceeds the amount of memory available. As this requires frequent data movement between memory and disk, the DBMS should manage disk read and write carefully to avoid long stalls on disk I/O and maximize sequential access when possible.

### 4. Disk-Oriented DBMS Overview

The database is stored on disk, and the data within the database files are organized into pages, with the first page being the directory page. To operate on the data, the DBMS needs to bring the data into memory.

It does this by having a buffer pool that manages the data movement back and forth between disk and memory. The DBMS also has an execution engine that will execute queries. The execution engine will ask the buffer pool for a specific page, and the buffer pool will take care of bringing that page into memory and giving the execution engine a pointer to that page in memory. The buffer pool manager will ensure that the page is there while the execution engine operates on that part of memory.

### 5. DBMS vs. OS

A high-level design goal of the DBMS is to support databases that exceed the amount of available memory. Since reading/writing to disk is expensive, disk use must be carefully managed. We do not want large stalls from fetching something from disk to slow down everything else.

One way to achieve this virtual memory is by using mmap to map the contents of a file in a process' address space, which makes the OS responsible for moving pages back and forth between disk and memory. Unfortunately, this means that if mmap hits a page fault, the process will be blocked.

**Key Points:**

- You never want to use mmap in your DBMS if you need to write.
- The DBMS (almost) always wants to control things itself and can do a better job at it since it knows more about the data being accessed and the queries being processed.
- The operating system is not your friend.

**OS Tools:**

- `madvise`: Tells the OS know when you are planning on reading certain pages.
- `mlock`: Tells the OS to not swap memory ranges out to disk.
- `msync`: Tells the OS to flush memory ranges out to disk.

### 6. File Storage

In its most basic form, a DBMS stores a database as files on disk. Some may use a file hierarchy, others may use a single file (e.g. SQLite).

The DBMS traditionally store files in a proprietary format that are specific to the DBMS, therefore only the specific DBMS knows how to decipher their contents. More recently there are also portable file formats that are open specs which allow all DBMSs to read and write from them.

The DBMS's storage manager is responsible for managing a database's files. It represents the files as a collection of pages. It also keeps track of what data has been read and written to pages as well how much free space there is in these pages.

### 7. Database Pages

The DBMS organizes the database across one or more files in fixed-size blocks of data called pages. Pages can contain different kinds of data (tuples, indexes, etc). Most systems will not mix these types within pages. Some systems will require that pages are self-contained, meaning that all the information needed to read each page is on the page itself.

Each page is given a unique identifier (page ID). If the database is a single file, then the page id can just be the file offset. A page ID could be unique per DBMS instance, per database, or per table.

Most DBMSs use fixed-size pages to avoid the engineering overhead needed to support variable-sized pages.

**Page Concepts:**

- Hardware page (usually 4 KB).
- OS page (4 KB).
- Database page (1-16 KB).

Optimal database page size depends on the environment, database contents, and expected workload. DBMSs that specialize in read-only workloads tend to have larger page sizes (>= 1MB), while those that specialize in write-heavy workloads tend to have smaller pages (4-16KB).

The storage device guarantees an atomic write of the size of the hardware page. If the hardware page is 4 KB and the system tries to write 4 KB to the disk, either all 4 KB will be written, or none of it will.

### 8. Database Heap

There are a couple of ways to manage pages in files on the disk (e.g. {Tree, ISAM, Hashing} File Organization), and Heap File Organization is one of those ways. A heap file is an unordered collection of pages where tuples are stored in random order.

A common architecture for the DBMS to locate a page on disk given a page id is page directory, which are special pages that contain one location entry for each logical database objects (e.g. data pages, index pages). The page directory has to be synchronized with the actual pages. The DBMS also tracks metadata about pages' contents, include the amount of free space on each page, a list of free/empty pages, and the page types.

### 9. Page Layout

Every page includes a header that records meta-data about the page's contents: Page size, Checksum, DBMS version, Transaction visibility, Self-containment.

There are three main approaches to laying out data in pages: (1) tuple-oriented, (2) log-structured, and (3) index-oriented.

**Tuple-Oriented Storage:** In tuple-oriented storage, the entire tuple is stored in the page. A strawman approach to laying out tuples in a page is to keep track of how many tuples the DBMS has stored in the page and then append to the end every time a new tuple is added. However, problems arise when tuples are deleted or when tuples have variable-length attributes. A common layout scheme that solves this is slotted pages.

**Slotted Pages:**

- Most common approach used in DBMSs today.
- Header keeps track of the number of used slots, the offset of the starting location of the last used slot, and a slot array, which keeps track of the location of the start of each tuple.
- To add a tuple, the slot array will grow from the beginning to the end, and the data of the tuples will grow from end to the beginning. The page is considered full when the slot array and the tuple data meet.

### 10. Record IDs

The DBMS assigns each logical tuple a unique record identifier that represents its physical location in the database (e.g. file id, page id, slot number). Most DBMSs do not store ids in the tuple. Common record id size varies from 4 bytes to 10 bytes. Since these are physical locations within the DBMS, the application cannot rely on these IDs.

### 11. Tuple Layout

A tuple is essentially a sequence of bytes (these bytes do not have to be contiguous). It is the DBMS's job to interpret those bytes into attribute types and values.

**Tuple Header:**

- Visibility information for the DBMS's concurrency control protocol (i.e., information about which transaction created/modified that tuple).
- Bit Map for NULL values.
- Note that the DBMS does not need to store meta-data about the schema of the database here.

**Tuple Data:**

- Actual data for attributes.
- Attributes are typically stored in the order that you specify them when you create the table.
- Attributes must be word aligned.
- Most DBMSs do not allow a tuple to exceed the size of a page.

### 12. Data Representation

**Data Types:**

- **Integers:** Storage layout follows native format in C/C++.
- **Floats:** Storage layout follows IEEE-754 Standard or Fixed-point Decimals. Variable precision numbers are 'native' C/C++ types stored as specified by IEEE-754 (inexact but faster). Fixed precision numbers allow arbitrary precision and scale.
- **Strings:** Stored as header with length with data bytes or pointer to data page and offset. Overflow pages are used when the value cannot fit in a single page. Some systems allow large values to be stored in external files (BLOB type).
- **Dates:** Stored as 32/64-bit integer of micro or milli-seconds since Unix epoch.

**NULL Handling:**

- **Null Column Bitmap Header:** Store bitmap in centralized header, bit is set when the corresponding attribute is NULL. Most common approach in row-stores.
- **Special Values:** Use a special placeholder for NULL for a data type (e.g. INT32_MIN). Most common in column-stores.
- **Per-Attribute Null Flag:** Stores a flag per-attribute that marks a value is null. Undesirable because the extra bit per-attribute would need to be padded for alignment.

---

## Lecture 4: Memory & Disk Management

*Source: 04-bufferpool.pdf*

### 1. Introduction

This semester, our focus will be on disk-oriented database management systems. A disk-oriented architecture means that the DBMS's primary storage location is in persistent storage, like a hard drive (HDD) or flash storage (SSDs). This is different from an in-memory DBMS, where data is stored in volatile memory.

In the Von Neumann architecture, data must be in memory before we can operate on it. Any DBMS must be able to efficiently move data back and forth between disk and memory if it wants to operate on large amounts of data. The DBMS can achieve this with a Buffer Pool Manager.

At a high level, the buffer pool manager is responsible for moving physical pages of data back and forth from buffers in main memory to persistent storage. It also behaves as a cache, keeping frequently used pages in memory for faster access, and evicting unused or cold pages back out to storage.

**Optimization Goals:**

- **Spatial Control:** Refers to where pages are physically located on disk. The goal of spatial control is to keep pages that are used together often as physically close together as possible on disk. This can potentially help with prefetching and other optimizations.
- **Temporal Control:** Refers to when pages have been brought into memory and when they should be written back out to disk. Temporal control aims to minimize the number of stalls from having to read data from disk.

### 2. Buffer Pool

The buffer pool is an in-memory cache of pages between memory and disk. It is essentially a large memory region allocated inside of the database to temporarily store pages. It is organized as an array of fixed-size frames. When the DBMS requests a page, the buffer pool manager first checks if the page is already stored in a frame of memory, and if it is not found, the page is read/copied into a free frame from disk. We consider the buffer pool manager as a write-back cache, where dirty pages are buffered and not written to disk immediately on mutation.

**Uses:**

- Tuple Storage and Indexes
- Sorting and Join Buffers
- Query and Dictionary Caches
- Maintenance and Log Buffers

**Metadata:**

- **Page Table:** An in-memory hash table that keeps track of pages that are currently in memory. It maps page IDs to frame locations in the buffer pool.
- **Dirty Flag:** Set by a thread whenever it modifies a page. This indicates to the storage manager that the page must be written back to disk before eviction.
- **Pin Counter:** Tracks the number of threads that are currently accessing that page. A thread has to increment the counter before they access the page. If a page's pin count is greater than zero, then the storage manager is not allowed to evict that page from memory.
- **Access Tracking:** Tracks what transactions/who is accessing the page.

**Page Table vs. Page Directory:**

- **Page Directory:** The mapping from page ids to page locations on the physical database files. All changes must be recorded on disk to allow the DBMS to find them on restart.
- **Page Table:** The mapping from page ids to a copy of the page in buffer pool frames. This is an in-memory data structure that does not need to be stored on disk.

### 3. Operating Systems vs. Database Management Systems

**Locks vs. Latches:**

- **Locks:** A higher-level, logical primitive that protects the contents of a database (e.g., tuples, tables, databases) from other transactions. Database systems can expose to the user which locks are being held as queries are run. Locks need to be able to roll back changes.
- **Latches:** A low-level protection primitive that the DBMS uses for the critical sections in its internal data structures (e.g., hash tables, regions of memory). Latches are held for only the duration of the operation being made. Latches do not need to be able to roll back changes. This is often implemented with simple language primitives like mutexes and/or conditional variables.

**Problems with mmap:**

- Transaction Safety: The OS can flush dirty pages at any time.
- I/O Stalls: The DBMS doesn't know which pages are in memory. The OS might stall a thread on a page fault.
- Error Handling: It is difficult to validate pages. Any page access can cause a SIGBUS signal that the DBMS then must handle.
- Performance Issues: Internal OS data structure contention. TLB shootdowns.

**DBMS Advantages:**

- Flushing dirty pages to disk in the correct order.
- Specialized prefetching.
- Better buffer replacement policies.
- Thread / process scheduling.

### 4. Buffer Replacement Policies

When the DBMS needs to free up a frame to make room for a new page, it must decide which page to evict from the buffer pool, and uses a replacement policy to make this decision. The implementation goals of replacement policies are correctness, accuracy, speed, and metadata overhead.

Note: A pinned page cannot be evicted.

**Policies:**

- **LRU:** The Least Recently Used replacement policy maintains a timestamp of when each page was last accessed. The DBMS evicts the page with the oldest timestamp. This timestamp can be stored in a separate data structure, such as a queue that keeps pages in sorted order to reduce the search time on eviction.
- **CLOCK:** The CLOCK policy is an approximation of LRU without needing a separate timestamp per page. Each page is given a reference bit. When a page is accessed, it is set to 1. Organize the pages in a circular buffer with a 'clock hand'. When an eviction is requested, sweep the hand and check if a page's bit is set to 1. If yes, set it to zero, if no, then evict.

**Issues:**

- **Sequential Flooding:** LRU and CLOCK are both susceptible to sequential flooding, where the buffer pool's contents are polluted due to a sequential scan. Since sequential scans read many pages quickly, the buffer pool fills up and pages from other queries are evicted.
- **Frequency:** LRU does not account for the frequency of accesses. Least-Frequently Used maintains an access count for each page and then evicts pages with the lowest count. However, it ignores time and may accumulate stale pages.

**Alternatives:**

- **LRU-K:** Tracks the history of the last K references as timestamps and computes the interval between subsequent accesses. This history is used to predict the next time a page is going to be accessed.
- **Localization:** The DBMS chooses which pages to evict on a per query/transaction basis. This minimizes the pollution of the buffer pool from each query.
- **Priority Hints:** Allow transactions to tell the buffer pool whether page is important or not based on the context of each page during query execution.

**ARC (Adaptive Replacement Cache):** Developed by IBM Research and supports both LRU and LFU by dynamically adjusting the sizes of two lists based on workload access patterns.

- Recency List T1: Holds pages that have been accessed once recently.
- Frequency List T2: Holds pages that have been accessed at least twice.
- Target Size Parameter p: adjusts how much to favor recency (T1) versus frequency (T2).

**Dirty Pages:** Pages/frames keep track of a dirty flag/bit that denotes a page that has been modified by the DBMS. The fast path is when the page is not dirty, and the buffer pool manager can simply drop it. The slow path is when the page is dirty, and the buffer pool manager must write the changes back to disk. One way to avoid this problem is background writing, where the DBMS periodically walks through the page table and writes dirty pages to disk.

### 5. Disk I/O and OS Cache

The OS/hardware will try to maximize disk bandwidth by reordering and batching I/O requests. But they do not know which I/O requests are more important than others.

The DBMS maintains internal queue(s) to track page read/write requests from the entire system. The priority of the tasks are determined based on several factors: Sequential vs. Random I/O, Critical Path Task vs. Background Task, Table vs. Index vs. Log vs. Ephemeral Data, Transaction Information, User-based SLAs.

Most DBMS use Direct I/O (via the O_DIRECT flag) to bypass the OS's cache to avoid redundant copies of pages and having to manage different eviction policies. PostgreSQL is an example of a database system that uses the OS's page cache.

Side Note: fsync by default has silent errors and on errors marks the page as clean.

---

## Lecture 5: Database Storage (Part II)

*Source: 05-storage2.pdf*

### 1. Buffer Pool Optimizations

There are several ways to optimize a buffer pool to tailor it to the application's workload.

**Multiple Buffer Pools:** The DBMS can maintain multiple buffer pools for different purposes (i.e. per-database, per-table, per-page type, etc.). Then, each buffer pool can adopt local policies tailored to the data stored inside of it. This method can help reduce latch contention and improve locality.

- **Object IDs:** Involve extending the record IDs to have an object identifier. A mapping from objects to specific buffer pools can be maintained via these object IDs. This allows a finer-grained control over buffer pool allocations but has a storage overhead.
- **Hashing:** The DBMS hashes the page ID to select which buffer pool to access. This is a more general and uniform approach.

**Pre-Fetching:** The DBMS can also be optimized by pre-fetching pages based on the query plan. While the first set of pages is being processed, the second can be pre-fetched into the buffer pool. This method is commonly used by DBMSs when accessing many pages sequentially during a sequential scan. It is also possible for a buffer pool manager to prefetch leaf pages in a tree index data structure benefiting index scans.

**Scan Sharing:** Query cursors can reuse data retrieved from storage or operator computations. This allows multiple queries to attach to a single cursor that scans a table. If a query starts a scan and there is another active scan, then the DBMS will attach the second query's cursor to the existing cursor. The DBMS keeps track of where the second query joined with the first so that it can finish the scan when it reaches the end of the data structure.

**Summary:** Overall, the DBMS can almost always manage memory better than the OS. It can leverage the semantics about the query plan to make better decisions: Evictions, Allocations, Pre-fetching.

### 2. Tuple-Oriented Storage

The most common way to store tuples on disk is the Tuple-Oriented Storage architecture, using the slotted-page scheme. Tuples are retrieved using its record ID.

**Retrieval:**

1. Check the page directory to find the page position on disk.
2. Fetch the page from disk into memory (into the buffer pool).
3. Use the slot array to find the tuple's offset within the page.

**Insertion:**

1. Check the page directory to find a page with a free slot.
2. Fetch the page from disk into memory.
3. Use the slot array to check if there is enough free space in the page.
4. If not, find another page with a free slot or create a new page.
5. Insert the tuple into the page and update the slot array.

**Update:**

1. Navigate to the tuple using the record ID with the same steps as retrieval.
2. If the new value fits in the same space, update in place.
3. Otherwise, mark the old value as deleted and insert the new value as if it were a new tuple.

**Problems:**

- **Fragmentation:** Deletion of tuples can leave gaps in the pages, making them not fully utilized.
- **Useless Disk I/O:** Due to the block-oriented nature of non-volatile storage, the whole block needs to be fetched to update a tuple.
- **Random Disk I/O:** The disk reader could have to jump to 20 different places to update 20 different tuples, which can be very slow.

### 3. Log-Structured Storage

Instead of storing tuples in pages and updating them in-place, Log-Structured Storage maintains a log that records changes to tuples. This idea is based on log-structured file systems (LSFS) and log-structured merge trees (LSM Tree).

**Mechanism:** The DBMS applies changes to an in-memory data structure (MemTable) and writes out the changes sequentially to disk (SSTable). The records stored in these structures contain the tuple's unique identifier, the type of operation (PUT/DELETE), and for a PUT operation, the contents of the tuple.

Logs are first stored in MemTable through fast, in-memory operations. Once MemTable fills up, the DBMS serializes the logs it stores and writes them to disk as an SSTable. The DBMS also sorts each SSTable by key before writing it to disk. Since the SSTables are immutable and written to disk sequentially, this results in less random disk I/O.

**Reading:** To read a record, the DBMS first checks MemTable to see whether it exists there. If the key does not exist in MemTable, then the DBMS has to check the SSTables at each level. To avoid slow brute force searches, the DBMS can maintain an in-memory SummaryTable to track additional metadata like min/max key per SSTable and a key filter (e.g., Bloom filter) per level.

**Compaction:** In a write-heavy workload, the DBMS will accumulate a large number of SSTables on disk. Thus, the DBMS can periodically use a sort-merge algorithm to combine SSTables by taking only the most recent change for each tuple. This reduces wasted space and speeds up reads.

- **Universal Compaction:** SSTables reside in a single 'universal' level. DBMS will trigger compaction when size thresholds are met or too many SSTables overlap in key ranges.
- **Level Compaction:** The smallest files are level 0. Level 0 files can be compacted to create a bigger level 1 file, level 1 files can be compacted to a level 2 file, etc. SSTables in the same level are managed with sorted and non-overlapping key ranges (except for level 0).

**Tradeoffs:**

- Fast sequential writes, good for append only storage.
- Reads may be slow.
- Compaction is expensive.
- Write amplification (for each logical write, there could be multiple physical writes during the compaction process).

### 4. Index-Organized Storage

Both slotted-page storage and log-structured storage rely on an additional index to find individual tuples because the tables are inherently unsorted. In the index-organized storage scheme, the DBMS directly stores a table's tuples as the value of an index data structure (e.g. B+ tree, skip list, trie). The DBMS uses a page layout similar to a slotted page, and tuples are typically sorted in the page based on key.

---

## Lecture 6: Storage Models & Compression

*Source: 06-storage3.pdf*

### 1. Database Workloads

- **OLTP (Online Transaction Processing):** Characterized by fast, short running operations, repetitive operations and simple queries that operate on single entity at a time. OLTP workloads typically handle more writes than reads, and only read/update a small amount of data each time. Example: The Amazon storefront.
- **OLAP (Online Analytical Processing):** Characterized by long running, complex queries (which often involves computing aggregates) and reads on large portions of the database. In OLAP workloads, the database system is often analyzing and deriving new data from existing data collected on the OLTP side. Example: Personalized Amazon shopping ads.
- **HTAP (Hybrid Transaction + Analytical Processing):** A new type of workload where OLTP and OLAP workloads are present together on the same database instance.

**Summary:**

- OLTP - Simple Queries, Write Heavy
- OLAP - Complex Queries, Read Heavy
- HTAP - A mix of both the above

### 2. Storage Models

**N-Ary Storage Model (NSM) - Row Store:**

In the n-ary storage model, the DBMS stores all of the attributes for a single tuple (row) contiguously in a single page. This approach is ideal for OLTP workloads where requests are write-heavy and accesses are mostly individual entities. It is ideal because it takes only one fetch to be able to get all of the attributes for a single tuple. NSM pages are typically some constant multiple of 4KB hardware pages.

- *Advantages:* Fast inserts, updates, and deletes. Good for queries that need the entire tuple (OLTP). Can use index-oriented physical storage for clustering.
- *Disadvantages:* Inefficient for scanning large portions of the table and/or a subset of the attributes. Poor memory locality in access patterns. Difficult to apply compression because of multiple value domains within a single page.

**Decomposition Storage Model (DSM) - Column Store:**

In the decomposition storage model, the DBMS stores a single attribute (column) for all tuples contiguously in a block of data. This model is ideal for OLAP workloads with many read-only queries that perform large scans over a subset of the table's attributes.

- *Advantages:* Reduces the amount of I/O wasted per query because the DBMS only reads the attributes that it needs. Better (faster) query processing because of increased locality and cached data reuse. Better data compression.
- *Disadvantages:* Slow for point queries, inserts, updates, and deletes because of tuple splitting/stitching.

**Tuple Reconstruction:**

- **Fixed-length offsets:** The most commonly used approach. The value in a given column will belong to the same tuple as the value in another column at the same offset. Therefore, every single value within the column will have to be the same length.
- **Embedded tuple ids:** For every attribute in the columns, the DBMS stores a tuple id (ex: a primary key) with it. Then, the system would also store a mapping to tell it how to jump to every attribute that has that id. This method has a large storage overhead.

**Partition Attributes Across (PAX):**

In the hybrid PAX storage model, the DBMS vertically partitions attributes within a database page. The goal is to get the benefit of faster processing on columnar storage while retaining the spatial locality benefits of row storage.

In PAX, the rows are horizontally partitioned into groups of rows. Within each row group, the attributes are vertically partitioned into columns. Each row group is similar to a column store for its subset of the rows.

A PAX file has a global header containing a directory with offsets to the file's row groups, and each row group maintains its own header with meta-data about its contents.

### 3. Database Compression

Compression is widely used in disk-based DBMSs as disk I/O is (almost) always the main bottleneck. It is especially popular in systems that have read-only analytical workloads. The DBMS can fetch more useful tuples, if they have been compressed beforehand at the cost of greater computational overhead for compression and decompression.

In-memory DBMSs are more complicated since they do not have to fetch data from disk to execute a query. Memory is much faster than disks, but compressing the database reduces DRAM requirements and processing. They have to strike a balance between speed vs. compression ratio.

**Properties:**

- Must produce fixed-length values. The only exception is variable length data stored in separate pools. This is because the DBMS should follow word-alignment and be able to access data using offsets.
- Allow the DBMS to postpone decompression as long as possible during query execution (late materialization).
- Must be a lossless scheme because people do not like losing data. Any kind of lossy compression has to be performed at the application level.

**Compression Granularity:**

- Block Level: Compress a block of tuples for the same table.
- Tuple Level: Compress the contents of the entire tuple (NSM only).
- Attribute Level: Compress a single attribute value within one tuple. Can target multiple attributes for the same tuple.
- Columnar Level: Compress multiple values for one or more attributes stored for multiple tuples (DSM only). This allows for more complicated compression schemes.

### 4. Naive Compression

The DBMS compresses data using a general purpose algorithm (e.g., Deflate, LZO, LZ4, Snappy, Oracle OZIP, Zstd, Lizard). Although there are several compression algorithms that the DBMS could use, engineers often choose ones that often provides lower compression ratio in exchange for faster compression/decompression.

The DBMS compresses disk pages, pads them to a power of 2KBs and stores them into the buffer pool. However, every time the DBMS tries to read/update data, the compressed data in the buffer pool must first be decompressed. For blind writes, no decompression required.

Since accessing data requires decompression of compressed data, this limits the scope of the compression scheme. Another problem is that these naive schemes also do not consider the high-level meaning or semantics of the data. The algorithm is oblivious to both the structure of the data, and how the query is planning to access the data.

### 5. Columnar Compression

Built-in compression schemes that allow DBMSs to read tuples without having to decompress them to their original form.

- **Run-Length Encoding (RLE):** Compresses runs (consecutive instances) of the same value in a single column into triplets: The value of the attribute, The start position in the column segment (offset), The number of elements in the run (length). The DBMS should sort the columns intelligently beforehand to maximize compression opportunities.
- **Bit-Packing Encoding:** When all values for an attribute are less than the value's declared largest size, store them with fewer bits.
- **Patching / Mostly Encoding:** Bit-packing variant that uses a special marker to indicate when a value exceeds the largest size and then maintains a look-up table to store them. Use when values are 'mostly' less than the largest size.
- **Bitmap Encoding:** The DBMS stores a separate bitmap for each unique value of a particular attribute where an offset in the vector corresponds to a tuple. This approach is only practical if the value cardinality is low, since the size of the bitmap is linearly proportional to the cardinality of the attribute value.
- **Delta Encoding:** Instead of storing exact values, record the difference between values that follow each other in the same column. The base value can be stored in-line or in a separate look-up table. We can also use RLE on the stored deltas to get even better compression ratios.
- **Dictionary Compression:** The most common database compression scheme. The DBMS replaces frequent patterns in values with smaller codes. It then stores only these codes and a data structure (i.e. the dictionary) that maps these codes to their original value. A dictionary compression scheme needs to support fast encoding/decoding, and needs to be order-preserving if it needs to work with range queries.

---

## Lecture 7: Hash Tables

*Source: 07-hashtables.pdf*

### 1. Data Structures

A DBMS uses various data structures for many different parts of the system internals.

- **Internal Meta-Data:** Data that keeps track of information about the database and the system state. Ex: Page tables, page directories.
- **Core Data Storage:** Data structures store the actual tuples (records) in the database.
- **Temporary Data Structures:** The DBMS can build ephemeral data structures on the fly while processing a query to speed up execution. Ex: hash tables for joins.
- **Table Indices:** Additional data structures that help efficiently locate specific tuples.

**Design Decisions:**

- Data organization: We need to consider the layout of the data structure and how it impacts performance.
- Concurrency: We also need to ensure that multiple threads can access the data structure simultaneously without causing conflicts, while maintaining data integrity and correctness.

### 2. Hash Table

A hash table implements an associative array abstract data type that maps keys to values. It provides on average O(1) operation complexity (O(n) in the worst-case) and O(n) storage complexity. Note that even with O(1) operation complexity on average, there are constant factor optimizations which are important to consider in the real world. There is no sequential access with respect to other keys.

**Two Components:**

- **Hash Function:** This tells us how to map a large key space into a smaller domain. It is used to compute an index into an array of buckets or slots. Tradeoff between speed and collision chance.
- **Hashing Scheme:** This tells how to handle key collisions after hashing. Tradeoff between larger hash table (fewer collisions) and additional operations on collision.

### 3. Hash Functions

A hash function takes in any key as its input. It then returns an integer representation of that key (i.e., the 'hash'). The function's output is deterministic (i.e., the same key should always generate the same hash output).

The DBMS need not use a cryptographically secure hash function (e.g., SHA-256) because we do not need to worry about protecting the contents of keys. These hash functions are primarily used internally by the DBMS and thus information is not leaked outside of the system. In general, we only care about the hash function's speed and collision rate.

The current state-of-the-art hash function is Facebook XXHash3.

### 4. Static Hashing Schemes

A static hashing scheme is one where the size of the hash table is fixed and known before. This means that if the DBMS runs out of storage space in the hash table, then it has to rebuild a larger hash table from scratch, which is very expensive. Typically the new hash table is twice the size of the original hash table.

To reduce the number of wasteful comparisons, it is important to avoid collisions of hashed key. Typically, we use twice the number of slots as the number of expected elements.

**Linear Probe Hashing:** The most basic hashing scheme, and typically the fastest. It uses a circular buffer of array slots. Compared to bucket chained hashing, it offers reduced memory overhead by avoiding pointer storage and better cache performance due to contiguous memory access. However, it can suffer from primary clustering when the load factor becomes high.

- *Insertion:* When a collision occurs, linearly search the subsequent slots until an open one is found.
- *Lookup:* Check the slot the key hashes to, and search linearly until the desired entry or an empty slot.
- *Deletion:* Use tombstones (replace entry with marker to keep scanning) or shift adjacent data.
- *Non-unique keys:* Separate Linked List or Redundant Keys (more common).
- *State-of-the-art:* Google's `absl::flat_hash_map`.

**Cuckoo Hashing:** Maintains multiple hashtables with different hash functions (same algorithm, different seeds). When inserting, check every table and choose one with a free slot. If no free slot, evict an old entry and rehash it into a different table. Guarantees O(1) lookups and deletions, but insertions may be more expensive.

### 5. Dynamic Hashing Schemes

Dynamic hashing schemes are able to resize the hash table on demand without needing to rebuild the entire table.

- **Chained Hashing:** Most common dynamic scheme. Maintains a linked list of buckets for each slot. Keys that hash to the same slot are inserted into the linked list.
- **Extendible Hashing:** Improved variant of chained hashing that splits buckets instead of allowing chains to grow. Multiple slot locations can point to the same bucket chain. Uses global and local depth bit counts to determine how many most significant bits to examine.
- **Linear Hashing:** Maintains a split pointer that tracks the next bucket to split. No matter whether the pointer is pointing to the bucket that overflowed, the DBMS always splits at the pointer location. The table grows or shrinks incrementally, avoiding the high cost of a full rebuild.

---

## Lecture 8: Indexes & Filters I

*Source: 08-indexes1.pdf*

### 1. Indexes

An index is a replica of a subset of a table's attributes that is organized and/or sorted for efficient access to the location of specific tuples. So instead of performing a sequential scan, the DBMS can perform a lookup on the index to find certain tuples more quickly. The DBMS ensures that the contents of the tables and the indexes are always logically in sync.

There exists a trade-off between the number of indexes to create per database. Although having more indexes makes looking up queries faster, indexes also use storage and require maintenance. Plus, there are concurrency concerns with respect to keeping them in sync. It is the DBMS's job to figure out the best indexes to use to execute queries.

### 2. B+Tree

A B+Tree is a self-balancing tree data structure that keeps data sorted and allows searches, sequential access, insertions, and deletions in O(log(n)). It is optimized for disk-oriented DBMSs that read/write large blocks of data as it converts what would have potentially been random I/O to sequential I/O.

Almost every modern DBMS that supports order-preserving indexes uses a B+Tree. The primary difference between the original B-Tree and the B+Tree is that B+Trees store values only in leaf nodes. Modern B+Tree implementations combine features from other B-Tree variants, such as the sibling pointers used in the B^link-Tree.

**Properties:**

- It is perfectly balanced (i.e., every leaf node is at the same depth).
- Every inner node other than the root is at least half full (m/2 - 1 <= num of keys <= m - 1).
- Every inner node with k keys has k+1 non-null children.

**Node Contents:**

- **Leaf Nodes:** The keys are derived from the attribute(s) that the index is based on. Two approaches for values: record IDs (pointer to tuple location) and tuple data (actual contents).
- **Inner Nodes:** The values contain pointers to other nodes, and the keys can be thought of as guide posts for tree traversal.

**Insertion:**

1. Find correct leaf L.
2. Add new entry into L in sorted order. If L has enough space, done. Otherwise split L into L1 and L2, redistribute entries evenly and copy up the middle key. Insert an entry pointing to L2 into the parent of L.
3. To split an inner node, redistribute entries evenly, but push up the middle key.

**Deletion:**

1. Find correct leaf L.
2. Remove the entry. If L is at least half full, done. Otherwise, try to borrow from a sibling. If borrowing fails, merge L and a sibling.
3. If a merge occurred, delete the entry in the parent pointing to L.

**Composite Index:** The key is composed of multiple attributes. Can use the index for queries that provide any of the attributes of the search key.

**Duplicate Keys:**

- Append record IDs (each tuple's record ID is unique).
- Overflow nodes (allow leaf nodes to spill into overflow nodes).

**Clustered Indexes:** The table is stored in the sorted order specified by the primary key, as either heap- or index-organized storage.

### 3. B+Tree Design Choices

- **Node Size:** Depends on storage medium. Hard drives: megabytes to amortize expensive disk reads. In-memory: as small as 512 bytes to fit in CPU cache. Also depends on workload type.
- **Merge Threshold:** Sometimes beneficial to temporarily violate the merge rule to reduce deletion operations. Eager merging could lead to thrashing. Allows for batched merging.
- **Variable Length Keys:** Pointers (only embedded devices), Variable Length Nodes (infeasible), Padding (wasteful), Key Map/Indirection (nearly universal - replace keys with index to key-value pair in separate dictionary).
- **Intra-Node Search:** Linear (O(n), can use SIMD), Binary (O(ln(n)), more expensive inserts), Interpolation (fastest but limited applicability).

### 4. Optimizations

- **Prefix Compression:** Store the common prefix once at the beginning of the node and only include the unique sections of each key.
- **Deduplication:** For non-unique key indexes, write the key once and follow it with all associated values.
- **Suffix Truncation:** For inner nodes, only store the minimum prefix needed to correctly route probes.
- **Pointer Swizzling:** Store actual raw pointers in place of page IDs to skip buffer pool fetches.
- **Bulk Insert:** Build a sorted linked list of leaf nodes first, then construct the index from the bottom up.
- **Write-Optimized:** B-epsilon-Tree logs changes in internal nodes and lazily propagates updates to leaf nodes.

---

# Part 2: Indexes, Joins & Query Processing (Lectures 9-16)

---

## Lecture 9: Indexes & Filters II

*Source: 09-indexes2.pdf*

### 1. Index vs. Filters

An index answers the question "where is the data?" while a filter answers "does this element exist in the set?" If the DBMS knows an element is not in a set, we save time finding it in the set while it does not exist. For example, within a chained hash table, we can put a filter at each bucket pointer. If the filter says negative, we then know the key is not in the chain thus saving our time traversing through the whole chain. We need both indexes and filters in a database, and sometimes putting a filter on the index will help speed up operations.

### 2. Bloom Filter

A Bloom filter is a probabilistic filter implemented with bitmap. By probabilistic, it means a Bloom filter does not always give the correct answer to a set membership query (false positives). However, a Bloom filter guarantees that it will never have false negatives.

**Parameters:** Size of the bitmap, Numbers of hash functions to use.

- **Insert:** The pre-defined hash functions are used on the inserted element x. For each function's output hash value, modular it with the bitmap size, then set the corresponding position in the bitmap to one.
- **Lookup:** Similar operation on element x. Each hash function takes x as input and modular the output value with bitmap size. If any of the corresponding positions is not one, return false. Otherwise return true (must verify in the actual set).

**Variations:**

- **Counting Bloom filter:** Instead of bits, use integers to count occurrences. Supports dynamically adding and removing keys.
- **Cuckoo filter:** Same idea as Cuckoo Hash, but store fingerprints of elements. Also supports dynamic add/remove.
- **Succinct range filter:** An immutable compact trie that supports approximate exact matches and range filtering.

### 3. Skip List

A Skip List uses multiple levels of linked lists to skip some nodes and thus traverse faster. Each level has 1/2 the keys of the level below it. Like the B+tree, it stores keys in an ordered manner. However, it does not require rebalancing during insertion or deletion, and still provides O(log n) approximate search times. It is commonly seen in in-memory data structures such as memtable.

- **Find:** Go to the top-level linked list and traverse until the value is about to be greater than the target. Then go down to the next level and traverse the same way until reaching the bottom list and the target key.
- **Insert:** Coins are flipped to decide until which level the new node is inserted. Insertions on different levels are done from bottom to top. Note that if the linked list is in one direction, each level's insertion could be done by an atomic pointer in-memory swap, thus no latch is needed.
- **Delete:** Every node has a boolean field to mark whether it is deleted or not. At first, a node is marked as deleted instead of removed directly to prevent other reader threads from visiting the dead object. Actual deletions are done by a background thread.

**Advantages:** Less memory usage if not including reverse pointer compared to B+tree. No rebalancing needed.

**Disadvantages:** Not disk/cache friendly. Reverse search is non-trivial.

### 4. Trie

Because a B+tree does not provide information about whether a node exists below an inner node or not, it's essential to go down to the leaf node to find out a node does not exist. A trie is an order-preserving data structure that stores keys as digits. The tree shape depends on keys and lengths, does not depend on insertion order. It does not require rebalancing. All operations have O(k) complexity where k is the length of the key.

The span of each trie level is the number of bits that each partial key/digit represents. A n-way Trie means each node will have a fan-out of n.

**Compression:**

- **Horizontal compression:** If we have a known span of a level, we can horizontally compress the node to an array instead of a map.
- **Vertical compression (Radix tree):** If a node has only a single child, we can vertically compress the nodes below. False positives may happen because the full key is no longer embedded in the trie.

### 5. Inverted Index

The indexes discussed before are only good for point or range searches. They do not support keyword search. An inverted index stores an immutable mapping of terms to records (the posting list) that contain those terms.

**Implementations:**

- **Lucene:** Uses a 'finite state transducer' (trie-like). Instead of storing pointers, it stores weights on every edge. Rolling sum of weights gives exact position in the mapping. Immutable; separate transducer for new keys with background merging.
- **PostgreSQL (GIN):** Uses a B+tree for the term dictionary. Small posting lists: sorted list of record IDs. Large posting lists: additional B+tree structures. Separate pending list for avoiding small incremental updates.

**Enhancements:**

- Rankings: Rank search results based on term frequency.
- Tokenizers: Split terms into n-grams to support fuzzy text searches and autocomplete.

### 6. Vector Index

Inverted indexes support keyword search but not semantic meaning. Large language models generate embeddings that are geometrically close if they have similar semantic meanings.

- **Inverted Indexes (IVFFlat):** Partition vectors by clustering, build inverted index mapping cluster centroids to records. Use k-means clustering on embeddings to find centroids.
- **Graph (FAISS, HNSWlib):** Build a graph where each node represents a vector and edges link to nearest neighbors. Greedily choose edges that move closer to target vector. Multiple levels of graphs (similar to skip lists) speed up search.

### 7. Optimizations

- **Partial Indexes:** Create an index on a subset of the table by adding a WHERE clause to the index definition.
- **Index Include Columns:** Embed additional columns in indexes to support index-only queries. Extra columns stored only in leaf nodes and are not part of the search key.

---

## Lecture 10: Index Concurrency Control

*Source: 10-indexconcurrency.pdf*

### 1. Index Concurrency Control

Most DBMSs need to allow multiple threads to safely access data structures. A concurrency control protocol is the method that ensures 'correct' results for concurrent operations on a shared object.

**Correctness Criteria:**

- **Logical Correctness:** The worker reads values it expects (e.g., reads back what it wrote).
- **Physical Correctness:** The internal representation of the object is sound (no invalid memory pointers).

### 2. Locks vs. Latches

- **Locks:** Higher-level, logical primitive protecting database contents from other transactions. Held for entire transactions. System detects deadlocks and rolls back changes.
- **Latches:** Low-level protection for DBMS's internal data structures from other workers. Held for short periods. Worker's responsibility to avoid deadlocks.

**Latch Modes:**

- **READ:** Multiple workers can read simultaneously.
- **WRITE:** Only one worker can access; prevents all other locks.

### 3. Latch Implementations

**Goals:** Small memory footprint, fast execution path when no contention, decentralized management, avoid expensive system calls.

- **Test-and-Set Spin Latch** (`std::atomic<T>`): Efficient latch/unlock (single instruction) but not scalable nor cache-friendly under high contention.
- **Blocking OS Mutex** (`std::mutex`): Simple to use. Linux uses futex (fast user-space mutex). Expensive (~25 ns per lock/unlock) due to OS scheduling.
- **Reader-Writer Latches** (`std::shared_mutex`): Allows concurrent readers. DBMS must manage read/write queues to avoid starvation. Larger storage overhead.

### 4. Hash Table Latching

Easy to support concurrent access in static hash tables because threads move in the same direction and access one page/slot at a time. No deadlocks possible.

- **Page Latches:** Each page has its own Reader-Writer latch. Decreases parallelism but fast for single thread.
- **Slot Latches:** Each slot has its own latch. Increases parallelism but more overhead.
- **Latch-Free:** Use CAS instructions directly. Insertion via compare-and-swap on 'null' value.

### 5. B+Tree Latching

Challenges: (1) Threads modifying node contents simultaneously, (2) One thread traversing while another splits/merges.

**Latch Crabbing/Coupling Protocol:**

1. Get latch for the parent.
2. Get latch for the child.
3. Release latch for the parent if the child is deemed 'safe' (will not split, merge, or redistribute).

**Safe Node:** For insertion: not full. For deletion: more than half full.

- **Find:** Start at root, go down, acquire latch on child then unlatch parent.
- **Insert/Delete:** Start at root, obtain X latches. Once child is latched, check if safe. If safe, release all ancestor latches.

**Optimistic Protocol:** Assume resizing is rare. Acquire shared latches down to leaf. If leaf is not safe, abort and restart with write latches.

**Leaf Node Scans:** Susceptible to deadlocks since threads acquire locks in two different directions simultaneously. Must support a 'no-wait' mode.

---

## Lecture 11: Sorting & Aggregation Algorithms

*Source: 11-sorting.pdf*

### 1. Query Plan

The database system will compile SQL into a query plan, which is a tree or DAG of operators. For a disk-oriented database system, we will use the buffer pool to implement algorithms that need to spill to disk. We want to minimize I/O for an algorithm and prefer sequential over random I/O.

### 2. Sorting

DBMSs need to sort because tuples have no specific order under the relational model (ORDER BY), and operators like GROUP BY, JOIN, and DISTINCT potentially use sorting. If data fits in memory, use standard algorithms (quicksort, vergesort). If not, use external sorting.

**Top-N Heap Sort:** For ORDER BY with LIMIT, scan data once maintaining a priority queue of top-N elements. Ideal when top-N fits in memory.

**External Merge Sort:**

- Phase 1 - Sorting: Sort small chunks that fit in memory, write sorted pages back to disk.
- Phase 2 - Merge: Combine sorted runs into larger sorted runs.

**Two-Way Merge Sort:** Uses three buffer pages. Makes 1 + ceil(log2(N)) passes. Total I/O cost: 2N x (# passes).

**K-Way Merge Sort:** Uses B buffer pages. Sort phase: read and sort B pages at a time. Merge: combine up to B-1 runs per pass. Performs 1 + log(B-1)(ceil(N/B)) passes.

**Optimizations:**

- **Double Buffering:** Prefetch next run in background while processing current run.
- **Code Specialization:** Hard-code comparator for specific key type.
- **Suffix Truncation:** Only compare part of keys first for strings.
- **Key Normalization:** Convert variable-length keys into fixed-length encoded strings.

**Using B+Trees:** Clustered index: just traverse the tree (always better than external merge sort). Unclustered index: almost always worse.

### 3. Aggregations

An aggregation operator collapses values of one or more tuples into a single scalar value. Two approaches:

**Sorting:** Sort on GROUP BY key(s), then sequential scan over sorted data to compute aggregation. Output is sorted.

**Hashing:** Computationally cheaper when output order doesn't matter. Build ephemeral hash table while scanning.

**External Hashing Aggregate (when too large for memory):**

- Phase 1 - Partition: Use hash function h1 to split tuples into B-1 partitions on disk.
- Phase 2 - ReHash: For each partition, read into memory and build in-memory hash table with h2, then compute aggregation.

**Choice:** In general, hashing is often more efficient unless the data is already sorted or the output must be sorted.

---

## Lecture 12: Joins Algorithms

*Source: 12-joins.pdf*

### 1. Introduction

The goal of a good database design is to minimize unnecessary repetition of information (normalization). Joins reconstruct the original tables.

Focus on inner equijoin algorithms for combining two tables. For binary joins, prefer the smaller table as the outer (left) table.

### 2. Join Operators

**Operator Output:**

- **Early Materialization:** Creates new output tuples with copies of joined values. Future operators never need base tables.
- **Late Materialization:** Only copies join keys and matching tuple record ids. Ideal for column stores.

**Cost Metric:** Number of disk I/Os. Given R (M pages, m tuples) and S (N pages, n tuples).

### 3. Nested Loop Join

Two nested for loops iterating over both tables with pairwise comparison.

| Variant | Cost |
|---|---|
| Naive Nested Loop | M + (m x N) |
| Block Nested Loop | M + (M x N) |
| Block NLJ with Buffer Pool | M + (ceil(M/(B-2)) x N) |
| Index Nested Loop | M + (m x C) |

### 4. Sort-Merge Join

Sort both tables on join key(s), then step through with cursors emitting matches.

Useful when tables are already sorted on join attribute(s) or output needs to be sorted.

**Cost:** Sort cost for R + Sort cost for S + Merge cost (M + N). Worst case merge: M x N (all tuples have same join attribute).

### 5. Hash Join

Uses hash table to split tuples into smaller chunks based on join attributes. Only for equi-joins on complete join key.

**Basic Hash Join:**

- Phase 1 - Build: Scan outer relation, populate hash table using h1.
- Phase 2 - Probe: Scan inner relation, use h1 to find matching tuples.

**Grace Hash Join (when tables don't fit in memory):**

- Phase 1 - Build: Hash both tables into partitions written to disk. Recursive partitioning with h2 if needed.
- Phase 2 - Probe: For each bucket level, retrieve corresponding pages and perform hash join.
- Cost: 3 x (M + N)

**Bloom Filter Optimization:** Create Bloom filter during build phase. Use during probe to answer "is key x in the hash table?" (sideways information passing).

### 6. Conclusion

Hash joins are almost always better than sort-based joins. Sort-based preferred for non-uniform data, already sorted data, or when result needs sorting.

| Algorithm | Cost | Example |
|---|---|---|
| Simple Nested Loop | M + (m x N) | ~1.4 hours |
| Block Nested Loop | M + (ceil(M/(B-2)) x N) | ~6.5 seconds |
| Sort-Merge | M + N + sort cost | ~0.75 seconds |
| Hash Join | 3 x (M + N) | ~0.45 seconds |

---

## Lecture 13: Query Processing I

*Source: 13-queryexecution1.pdf*

### 1. Query Plan

The DBMS converts SQL into a query plan. Operators arranged in a DAG (often a tree). Data flows from leaves towards root.

A **pipeline** is a sequence of operators where tuples flow continuously. A **pipeline breaker** cannot finish until all children emit their tuples (e.g., Joins build side, Subqueries, Order By).

### 2. Processing Models

**Iterator Model (Volcano / Pipeline):** Most common model. Each operator implements a Next function, emitting tuples one by one. Allows pipelining. Output control (LIMIT) works easily.

**Materialization Model:** Each operator processes all input at once and emits all output at once. Better for OLTP (small number of tuples). Not suited for OLAP with large intermediate results.

**Vectorization Model:** Like iterator model but emits batches (vectors) of data instead of single tuples. Ideal for OLAP. Allows SIMD instructions for batch processing.

**Processing Direction:**

- **Top-to-Bottom:** Start at root, 'pull' data from children. Easy LIMIT control. Parent blocks until child returns.
- **Bottom-to-Top:** Start at leaves, 'push' data to parents. Tighter cache/register control. Less control of intermediate result sizes.

### 3. Access Methods

**Sequential Scan Optimizations:**

- Compression (e.g., RLE)
- Prefetching
- Buffer Pool Bypass (avoid sequential flooding)
- Parallelization
- Late Materialization
- Heap Clustering
- Zone Maps (pre-computed aggregations per page for lossless data skipping)

**Index Scan:** Pick an index to find required tuples.

**Multi-Index Scan:** Compute sets of record IDs using each matching index, combine sets based on predicates.

### 4. Modification Queries

Operators that modify the database (INSERT, UPDATE, DELETE) check constraints and update indexes. For UPDATE/DELETE, child operators pass Record IDs.

**Halloween Problem:** An update changes the physical location of a tuple, causing a scan to visit it multiple times. Solution: track modified record IDs per query.

### 5. Expression Evaluation

The DBMS represents WHERE clauses as expression trees with nodes for comparisons, conjunctions/disjunctions, arithmetic operators, constants, and tuple attribute references.

**Optimizations:**

- **Constant Folding:** Identify operations that can be performed once and reuse results.
- **Sub Expression Limitation:** Identify repeated subexpressions and compute once for all occurrences.

---

## Lecture 14: Query Execution II

*Source: 14-queryexecution2.pdf*

### 1. Background

In practice, queries are executed in parallel with multiple workers. Parallel execution spreads the database over multiple resources (computational and storage).

**Benefits:** Handle large data sets, higher performance, higher redundancy/fault-tolerance.

### 2. Parallel vs. Distributed Databases

- **Parallel DBMS:** Resources physically close, high-speed interconnect, fast/cheap/reliable communication.
- **Distributed DBMS:** Resources may be far apart, slower interconnect (public network), higher communication costs, failures cannot be ignored.

### 3. Process Models

- **Process Per Worker:** Each worker is a separate OS process. Crash doesn't disrupt whole system. Used by IBM DB2, Postgres, Oracle.
- **Thread Per Worker:** Most common. Single process with multiple worker threads. DBMS has full scheduling control. Thread crash can kill entire process. Used by MSSQL, MySQL.
- **Embedded DBMS:** Runs in application's address space. Application handles scheduling. Used by DuckDB, SQLite, RocksDB.

### 4. Inter-Query Parallelism

Execute different queries concurrently. Increases throughput and reduces latency. Read-only queries need little coordination. Concurrent updates require more complex conflict handling.

### 5. Intra-Query Parallelism

Execute operations of a single query in parallel. Decreases latency for long-running queries.

- **Intra-Operator (Horizontal):** Decompose operators into independent fragments on different data subsets. Exchange operators coalesce results: Gather, Distribute, Repartition.
- **Inter-Operator (Vertical):** Overlap operators to pipeline data without materialization. Also called pipelined parallelism.
- **Bushy:** Hybrid of intra-operator and inter-operator. Workers execute multiple operators from different segments simultaneously.

### 6. I/O Parallelism

Split database across multiple storage devices.

- **Multi-Disk Parallelism:** OS/hardware stores DBMS files across multiple devices (RAID). Transparent to DBMS.
- **Database Partitioning:** Split into disjoint subsets assigned to discrete disks. Logical partitioning splits single table into disjoint physical segments.

---

## Lecture 15: Query Planning & Optimization

*Source: 15-optimization1.pdf*

### 1. Overview

Because SQL is declarative, the DBMS needs to translate SQL into an executable query plan and pick the optimal plan. The first query optimizer was IBM System R (1970s). Query optimization is the most difficult part of building a DBMS.

- **Logical Plan:** Roughly equivalent to relational algebra expressions.
- **Physical Plan:** Defines specific execution strategy using access paths. May depend on physical format of data. Not always a one-to-one mapping from logical plans.

### 2. Relational Algebra Equivalence

Query optimization relies on the fact that properties of relational algebra are preserved across equivalent expressions. This technique of transforming the relational algebra representation is known as query rewriting.

### 3. Types of Query Optimization

- **Heuristics/Rules:** Match portions of query with known patterns. Never need to examine data itself.
- **Cost-Based Search:** Read data and estimate cost of equivalent plans. Choose plan with lowest cost.

### 4. Logical Query Optimization

Transform a logical plan into an equivalent logical plan using pattern matching rules.

**Selection Optimizations:**

- Predicate Pushdown: Perform filters as early as possible.
- Reorder predicates so the most selective is applied first.
- Split Conjunctive Predicates and push them down.
- Replace Cartesian Products with Joins.

**Projection Optimizations:**

- Perform projections as early as possible (projection pushdown).
- Project out all attributes except those requested or required.

### 5. Cost-Based Query Optimization

After rule-based rewriting, enumerate different plans and estimate their costs. Choose the best plan after exhausting all plans or some timeout.

### 6. Cost Estimations

- CPU: small cost, tough to estimate.
- Disk I/O: number of block transfers.
- Memory: amount of DRAM used.
- Network: number of messages sent.

**Statistics:** NR = number of tuples in R. V(A,R) = number of distinct values of attribute A. Selection cardinality SC(A,R) = NR/V(A,R) (assumes data uniformity).

### 7. Search Termination

- Wall-clock Time: Stop after fixed duration.
- Cost Threshold: Stop when plan below threshold found.
- Exhaustion: Stop when no more enumerations remain.
- Transformation Count: Stop after fixed number of rule applications.

### 8. Single-Relation Query Plans

Biggest obstacle: choosing best access method. Most new systems use heuristics. OLTP queries are sargable (Search Argument Able) - there exists a best index for the query.

### 9. Multi-Relation Query Plans

As joins increase, alternative plans grow rapidly. Must restrict search space.

- **Bottom-up (Generative):** Start with nothing and build up the plan. Used by IBM System R, DB2, MySQL, Postgres, most open-source DBMSs.
- **Top-down (Transformation):** Start with the desired outcome and work down. Used by MSSQL, Greenplum, CockroachDB, Volcano.

### 10. System R Optimizer (Bottom-up)

Use static rules for initial optimization. Then dynamic programming to determine best join order using divide-and-conquer. Iteratively construct a 'left-deep' tree minimizing estimated work.

### 11. Volcano Optimizer (Top-down)

Begin with initial logical plan. Apply transformation rules (logical-to-logical) and implementation rules (logical-to-physical). Memoization prevents redundant exploration. Treats physical properties of data as first-class entities.

### 12. Nested Sub-Queries

DBMS treats nested sub-queries as functions.

- Re-write by de-correlating and/or flattening.
- Decompose and store result to temporary table.

### 13. Expression Rewriting

Transform query expressions into minimal set. Search for matching patterns, rewrite expressions, halt when no more rules match. Examples: impossible predicates (evaluate at optimization time), merging predicates.

---

## Lecture 16: Query Planning & Optimization II

*Source: 16-optimization2.pdf*

### 1. Multi-Relation Query Plans

**Bottom-up (System R):** Static rules for initial optimization, then dynamic programming for best join order. Iteratively construct 'left-deep' tree.

**Top-down (Volcano):** Apply transformation and implementation rules recursively. Memoization prevents redundant exploration. Enforcers ensure output properties of sub-plans.

### 2. Data Statistics

**Histograms:** Reduce memory by grouping values.

- **Equi-Width:** Combine counts for adjacent keys.
- **Equi-Depth:** Vary bucket widths so total occurrences per bucket are roughly the same.
- **End-Biased:** N-1 buckets for most frequent keys, last bucket for average frequency of remaining.

**Sketches:** Count-Min Sketch and HyperLogLog for approximate statistics.

**Sampling:** Apply predicates to a subset of the table. Maintain read-only copy or sample real tables. Update when changes exceed threshold (e.g., 10%).

### 3. Cost Estimations

Cost metrics: CPU, Disk I/O, Memory, Network.

Statistics: NR (number of tuples), V(A,R) (distinct values), SC(A,R) = NR/V(A,R).

**Selectivity:** The fraction of tuples that qualify for predicate P. Equivalent to the probability of that predicate.

### 4. Selectivity Computation Assumptions

- **Uniform Data:** Distribution of values (except heavy hitters) is the same.
- **Independent Predicates:** Predicates on attributes are independent.
- **Containment Principle:** Domain of join keys overlap such that each key in the inner relation exists in the outer table.

Note: These assumptions are often not satisfied by real data. Correlated attributes break independence.

### 5. Join Size Estimation

For join between R and S sharing non-primary-key attribute A, estimated join cardinality is approximately:

**(NR x NS) / max(V(A,S), V(A,R))**

Estimation errors can easily propagate through query plans, as inaccuracies in one operator's estimate may cascade and amplify in subsequent operations.

---

# Part 3: Concurrency, Recovery & Distributed (Lectures 17-24)

---

## Lecture 17: Concurrency Control Theory

*Source: 17-concurrencycontrol.pdf*

### 1. Motivation

Two key problems:

- **Lost Update Problem (Concurrency Control):** How do we handle two or more transactions trying to update the same data at the same time?
- **Durability Problem (Recovery):** How can we ensure the correct state in case of a power failure?

### 2. Transactions

A transaction is the execution of a sequence of one or more operations on a shared database to perform some higher level function. They are the basic unit of change in a DBMS. Partial transactions are not allowed (must be atomic).

**Example:** Pay $25 from Andy's bank account with balance $100: (1) Read balance, (2) Check if balance > $25, (3) Deduct $25, (4) Write new balance $75. Either all steps complete or none.

**Strawman System (Shadow Paging):** Execute one transaction at a time. Before starting, copy entire database to new file and make changes there. On success: new file becomes current. On failure: discard dirty copy. Drawbacks: slow, no concurrency, requires copying whole database.

**Interleaving Issues:**

- Temporary Inconsistency: Unavoidable, but not an issue.
- Permanent Inconsistency: Unacceptable, causes correctness problems.

### 3. Definitions

A database is a fixed set of named data objects (A, B, C...). A transaction is a sequence of read and write operations (R(A), W(B)).

**Transaction Boundaries:** BEGIN to start, then COMMIT or ABORT to stop.

**ACID Properties:**

- **Atomicity:** Either all actions happen, or none happen.
- **Consistency:** If each transaction is consistent and the database is consistent at the beginning, it's guaranteed to be consistent when the transaction completes.
- **Isolation:** Concurrent execution should have the same resulting database state as sequential execution.
- **Durability:** If a transaction commits, its effects persist no matter what happens.

### 4. ACID: Atomicity

Two approaches:

- **Logging:** Log all actions in ordered ledger so it can undo actions of aborted transaction. Used by almost all modern systems.
- **Shadow Paging:** Make copies of modified pages. Only when committed is the page made visible. Rarely used in practice.

### 5. ACID: Consistency

The 'world' represented by the database is logically correct. SQL has methods to specify integrity constraints (key definitions, CHECK, ADD CONSTRAINT).

**Eventual Consistency:** Committed transaction may see inconsistent results (may not see updates of older committed transaction immediately). Trend is moving toward stronger consistency models.

### 6. ACID: Isolation

Transactions have the illusion that they are running alone. Equivalent to serial execution but with interleaved operations for performance.

**Concurrency Control Categories:**

- **Pessimistic:** Assumes conflicts will happen; prevents problems in the first place.
- **Optimistic:** Assumes conflicts are rare; deals with them after they happen.

**Schedule Types:**

- Serial Schedule: No interleaved actions.
- Equivalent Schedules: Identical effect.
- Serializable Schedule: Equivalent to some serial execution.

**Conflict Types:**

- **Read-Write (Unrepeatable Reads):** Cannot get same value when reading same object multiple times.
- **Write-Read (Dirty Reads):** See write effects before commit.
- **Write-Write (Lost Updates):** Overwrite uncommitted data of another transaction.

**Serializability:**

- **Conflict Serializability:** Every pair of conflicting operations ordered the same way. Verified using dependency graphs (acyclic = serializable).
- **View Serializability:** Weaker notion allowing blind writes. Not used in practice.

**Universe:** Serial ⊂ Conflict Serializable ⊂ View Serializable ⊂ All Schedules

### 7. ACID: Durability

All changes of committed transactions must be durable (persistent) after crash or restart. No torn updates or changes from failed transactions.

---

## Lecture 18: Two-Phase Locking

*Source: 18-twophaselocking.pdf*

### 1. Transaction Locks

A DBMS uses locks to dynamically generate serializable execution schedules. The lock manager decides whether a transaction can acquire a lock.

- **Shared Lock (S-LOCK):** Allows multiple transactions to read the same object simultaneously.
- **Exclusive Lock (X-LOCK):** Allows one transaction to modify an object. Prevents all other locks on that object.

The lock-table does not need to be durable since active transactions at crash time are automatically aborted.

### 2. Two-Phase Locking

2PL is a pessimistic protocol that uses locks to determine access on the fly. Does not need to know all queries ahead of time.

**Phases:**

1. **Growing:** Transaction requests locks from lock manager. Grants/denies requests.
2. **Shrinking:** Begins after releasing first lock. Only allowed to release locks, not acquire new ones.

2PL is sufficient to guarantee conflict serializability.

**Issues:** Susceptible to cascading aborts, dirty reads, deadlocks, and limits concurrency.

### 3. Strong Strict Two-Phase Locking

Transactions only release locks when they commit. DBMS does not incur cascading aborts. Can reverse changes of aborted transactions by restoring original values. Generates more cautious schedules that limit concurrency.

**Universe:** Serial ⊂ Strong Strict 2PL ⊂ Conflict Serializable ⊂ View Serializable ⊂ All Schedules

### 4. Deadlock Handling

A deadlock is a cycle of transactions waiting for locks to be released by each other.

**Deadlock Detection:** DBMS creates a waits-for graph. Periodically check for cycles. When detected, select a 'victim' to abort.

Victim selection criteria: age, progress, items locked, transactions needed to rollback, times restarted (avoid starvation).

**Deadlock Prevention:** Stop deadlocks before they occur. Transactions assigned priorities via timestamps.

- **Wait-Die (Old Waits for Young):** Higher priority waits; otherwise aborts.
- **Wound-Wait (Young Waits for Old):** Higher priority causes abort of holder; otherwise waits.

### 5. Lock Granularities

Lock hierarchy: Database > Table > Page > Tuple > Attribute.

**Intention Locks:**

- **IS (Intention-Shared):** Explicit shared locking at lower level.
- **IX (Intention-Exclusive):** Explicit exclusive or shared locking at lower level.
- **SIX (Shared+Intention-Exclusive):** Sub-tree locked in shared mode with exclusive locking at lower levels.

**Lock Escalation:** DBMS automatically switches to coarser-grained locks when many lower level locks acquired.

### 6. Locking in Practice

Applications don't usually explicitly take locks; the DBMS infers necessary locks.

- `FOR UPDATE/FOR SHARE`: Indicate particular lock kind at end of SELECT. Useful for read-modify-write.
- `SKIP LOCKED`: Skip tuples where locks can't be acquired. Handy for queues inside a DBMS.

---

## Lecture 19: Timestamp Ordering Concurrency Control

*Source: 19-timestampordering.pdf*

### 1. Timestamp Ordering Concurrency Control

Timestamp ordering (T/O) is an optimistic class where the DBMS assumes conflicts are rare. Uses timestamps to determine serializability order instead of locks.

**Rule:** If TS(Ti) < TS(Tj), then execution schedule must be equivalent to serial schedule where Ti appears before Tj.

**Timestamp Allocation:** System clock (UTC), Logical counter (overflow/distributed issues), Hybrid approaches.

### 2. Optimistic Concurrency Control (OCC)

Uses timestamps to validate transactions. Works best when conflicts are low.

**Private Workspace:** DBMS creates private workspace per transaction. Modifications applied there. No other transaction can read another's workspace.

**Three Phases:**

1. **Read Phase:** Track read/write sets, store writes in private workspace. Copy every tuple accessed for repeatable reads.
2. **Validation Phase:** Assigned unique timestamp at commit. DBMS checks for conflicts with other transactions.
3. **Write Phase:** If validation succeeds, write timestamp assigned to modified objects and changes installed atomically. Otherwise abort and restart.

**Validation Approaches:** Forward validation (older to younger), Backward validation (younger to older, more common).

**Potential Issues:** High overhead for copying data locally, validation/write phase bottlenecks, wasteful aborts, timestamp allocation bottleneck.

### 3. Dynamic Databases and The Phantom Problem

The phantom problem arises when transactions only lock existing records, neglecting those being created.

**Phantom Read:** Transaction scans range multiple times; another transaction inserts/removes tuples in that range.

**Approaches:**

- Lock Everything (expensive, locks more than needed)
- Re-Execute Scans (check at commit time)
- Predicate Locking (rarely implemented due to complexity)
- **Index Locking (most common):** Key-Value Locks, Gap Locks, Key-Range Locks, Hierarchical Locking.

### 4. Isolation Levels

**Anomalies:** Dirty Read, Unrepeatable Reads, Lost Updates, Phantom Reads.

| Level | Dirty Read | Unrepeatable Read | Phantom | Implementation |
|---|---|---|---|---|
| SERIALIZABLE | No | No | No | Strict 2PL + Phantom Protection |
| REPEATABLE READS | No | No | Maybe | Strict 2PL |
| READ-COMMITTED | No | Maybe | Maybe | Strict 2PL for X-locks, immediate S-lock release |
| READ-UNCOMMITTED | Maybe | Maybe | Maybe | Strict 2PL for X-locks, no S-locks for reads |

---

## Lecture 20: Multi-Version Concurrency Control

*Source: 20-multiversioning.pdf*

### 1. Multi-Version Concurrency Control

MVCC involves all aspects of the DBMS's design and implementation. Most widely used scheme in the last 10 years.

**Fundamental Concept:** Writers do not block readers and readers do not block writers. One transaction can modify an object while others read old versions. Writers may still block other writers for the same object.

**Advantages:** Read-only transactions can read a consistent snapshot without locks. Naturally supports Snapshot Isolation. Supports time-travel queries without garbage collection.

### 2. Snapshot Isolation

Provides a transaction with a consistent snapshot of the database when it started. Data values consist only of values from committed transactions.

**Write Conflicts:** First writer wins.

**Write Skew Anomaly:** Two concurrent transactions modify different objects resulting in non-serializable schedules (e.g., one changes all white marbles to black and another changes all black to white).

### 3. Version Storage

How the DBMS stores different physical versions of a logical object.

**Version Chain:** Linked list of versions sorted by timestamp per logical tuple. Indexes point to 'head' of chain.

- **Append-Only Storage:** All versions in same table space. Ordering: O2N (requires chain traversal) or N2O (requires updating index pointers, typically better).
- **Time-Travel Storage:** Separate table for older versions. On update, old version copied to time-travel table.
- **Delta Storage:** Only stores deltas (changes). Faster writes but slower reads. Reconstruct by iterating deltas in reverse.

### 4. Garbage Collection

DBMS needs to remove reclaimable physical versions. A version is reclaimable if no active transaction can see it or it was created by an aborted transaction.

**Tuple-Level GC:**

- **Background Vacuuming:** Separate threads periodically scan for reclaimable versions. Can use 'dirty page bitmap' to skip unchanged pages.
- **Cooperative Cleaning:** Worker threads identify reclaimable versions while traversing chains. Only works with O2N. Data never cleaned if not accessed.

**Transaction-Level GC:** Each transaction tracks old versions. Uses read/write set to identify tuples to reclaim.

### 5. Index Management

All primary key indexes always point to version chain head. Primary key update treated as DELETE + INSERT.

**Secondary Index Approaches:**

- **Logical Pointers:** Fixed identifier per tuple that doesn't change. Requires indirection layer. Only update the mapping.
- **Physical Pointers:** Physical address to version chain head. Requires updating every index on version chain change. Very expensive.

**Duplicate Key Problem:** MVCC indexes must support duplicate keys from different snapshots since the same key may point to different logical tuples in different snapshots.

### 6. Deletes

DBMS physically deletes a tuple only when all versions are not visible.

- **Deleted Flag:** Maintain a flag indicating logical tuple has been deleted.
- **Tombstone Tuple:** Create empty physical version with special bit pattern.

---

## Lecture 21: Database Logging

*Source: 21-logging.pdf*

### 1. Crash Recovery

Recovery algorithms ensure database consistency, transaction atomicity, and durability despite failures.

**Key Primitives:**

- **UNDO:** Remove the effects of an incomplete or aborted transaction.
- **REDO:** Re-apply the effects of a committed transaction for durability.

### 2. Buffer Pool Management Policies

- **STEAL:** DBMS can write uncommitted changes to disk before transaction completes.
- **NO-STEAL:** DBMS cannot write uncommitted changes to disk.
- **FORCE:** All changes must be written to disk at commit time.
- **NO-FORCE:** Changes not required to be written at commit time.

**Common Combinations:**

- NO-STEAL + FORCE: Simple recovery but poor runtime performance.
- STEAL + NO-FORCE: Excellent runtime performance but more complex recovery.

### 3. Naive NO-STEAL + FORCE

Simplest policy. Never undo aborted (not written to disk). Never redo committed (guaranteed at commit). Critical limitation: all data must fit in memory. More frequent writes wear storage devices.

### 4. Shadow Paging (Smarter NO-STEAL + FORCE)

DBMS implements copy-on-write with two database versions: master (committed changes) and shadow (uncommitted changes). Database pages organized in tree structure. On commit, overwrite root to point to shadow (atomic).

**Disadvantages:** High overhead copying page table, expensive commits, data fragmentation, concurrency limitations.

### 5. Journal File (SQLite Pre-2010)

Before overwriting master page, copy original to journal file. After restart, if journal exists, restore original pages. Solves memory limitation but typically limited to one writer.

### 6. Write-Ahead Logging

DBMS records all changes in a log file on stable storage before the change is made to disk. Uses STEAL + NO-FORCE policy. Almost every modern DBMS uses WAL.

**Key Rule:** Log records must be flushed before flushing the corresponding object to disk.

**Implementation:**

- Write BEGIN record for each transaction.
- Write COMMIT record and flush all log records before acknowledging to application.
- Log entry contents: Transaction ID, Object ID, Before Value (UNDO), After Value (REDO), System data.

**Group Commit:** Batch multiple log flushes to amortize overhead. Flush when buffer full or sufficient time passed.

**Change Data Capture:** WAL can propagate changes to external systems (replicas, data warehouses, microservices).

### 7. Logging Schemes

- **Physical Logging:** Record byte-level changes to specific locations. (Like git diff)
- **Logical Logging:** Record high-level operations. Less data but difficult recovery with concurrent transactions.
- **Physiological Logging:** Hybrid. Target single page but don't specify data organization. Identify tuples by slot number. Most common approach.

### 8. Checkpoints

Main problem with WAL: log file grows forever.

**Purpose:** Log Pruning (discard old records), Recovery Efficiency (only REDO/UNDO from most recent checkpoint).

**Tradeoff:** Too often: runtime degrades. Too infrequent: longer recovery.

**Blocking Checkpoint:** Stop new transactions, wait for active ones to complete, flush all log records and dirty blocks, write CHECKPOINT entry. Bad for runtime but straightforward recovery.

---

## Lecture 22: Database Crash Recovery

*Source: 22-recovery.pdf*

### 1. Crash Recovery

**ARIES (Algorithms for Recovery and Isolation Exploiting Semantics):** Developed at IBM Research in early 1990s for DB2.

**Key Concepts:**

- Write Ahead Logging: STEAL + NO-FORCE.
- Repeating History During Redo: Retrace actions to restore exact state before crash.
- Logging Changes During Undo: Record undo actions to prevent repeated actions on repeated failures.

### 2. WAL Records

**LSN Types:**

| Name | Location | Definition |
|---|---|---|
| flushedLSN | Memory | Last LSN in log on disk |
| pageLSN | Page | Newest update to page |
| recLSN | Dirty Page Table | Oldest update to page since last flush |
| lastLSN | Active Transaction Table | Latest record of transaction |
| MasterRecord | Disk | LSN of latest checkpoint |

**Write Rule:** Before writing page i to disk, must flush log until pageLSN_i <= flushedLSN.

### 3. Normal Execution

**Transaction Commit:**

1. Write COMMIT record to log buffer in memory.
2. Flush all log records up to and including COMMIT to disk (sequential, synchronous).
3. Return acknowledgment to application.
4. Later write TXN-END record (internal bookkeeping, no immediate flush needed).

**Transaction Abort:**

- **prevLSN:** Additional field linking to previous LSN for the transaction (creates linked-list).
- **CLR (Compensation Log Record):** Describes actions to undo a previous update. Has undoNextLSN pointer. Never need to be undone.
- Steps: Append ABORT record, undo updates in reverse order, create CLR for each, write TXN-END.

### 4. Checkpointing

**Non-Fuzzy Checkpoints:** Halt execution, wait for all transactions to finish, flush dirty pages.

**Slightly Better Blocking:** Don't wait for active transactions but record internal state.

**Fuzzy Checkpoints (ARIES uses this):** Allow other transactions to continue. Log CHECKPOINT-BEGIN (snapshot ATT and DPT) and CHECKPOINT-END (contains ATT + DPT). MasterRecord stores LSN of CHECKPOINT-BEGIN.

**Data Structures:**

- **Active Transaction Table (ATT):** State of running transactions. Contains transactionId, status (Running/Committing/Undo Candidate), lastLSN. Contains every transaction without TXN-END.
- **Dirty Page Table (DPT):** Information about dirty pages in buffer pool. One entry per dirty page with recLSN.

### 5. ARIES Recovery

Three phases upon restart after crash:

**Phase 1 - Analysis:**

- Start from last checkpoint via MasterRecord.
- Scan log forward from checkpoint.
- TXN-END found: remove from ATT.
- All other records: add to ATT with UNDO status; on commit change to COMMIT.
- UPDATE records: if page not in DPT, add it with recLSN = log record's LSN.

**Phase 2 - Redo:**

- Scan forward from smallest recLSN in DPT.
- Re-apply all updates (even aborted) and CLRs unless: page not in DPT, LSN < recLSN, or pageLSN on disk >= LSN.
- Set pageLSN to log record's LSN (no additional logging).
- Write TXN-END for COMMIT status transactions.

**Phase 3 - Undo:**

- Reverse all transactions with UNDO status in ATT.
- Process in reverse LSN order using lastLSN.
- Pick largest lastLSN across all transactions at each step.
- Write CLR for each modification being reversed.
- Once last transaction aborted, flush log and ready for new transactions.

---

## Lecture 23: Introduction to Distributed Databases

*Source: 23-distributed1.pdf*

### 1. Distributed DBMSs

A distributed DBMS divides a single logical database across multiple physical resources. Applications are usually unaware of the split.

**Goals:** Fault tolerance (avoid single node failure), Scalability (data too large for single node).

**Parallel vs. Distributed:**

- Parallel: Physically close, high-speed LAN, small communication cost.
- Distributed: Potentially far apart, public network, high communication cost, failures cannot be ignored.

### 2. System Architectures

- **Shared Everything:** Single-node DBMS.
- **Shared Nothing:** Each node has own CPU, memory, disk. Only communicate via network. Potentially better performance but difficult to increase capacity and ensure consistency.
- **Shared Disk:** All CPUs read/write single logical disk via network, private memory. Common in cloud-based DBMSs. Decouples storage from execution, scales independently.
- **Shared Memory:** CPUs access common memory address space. Rare in practice (expensive).

### 3. Design Issues

Users should not need to know where data is physically located or how tables are partitioned/replicated (data transparency).

Key questions: How does the application find data? Where to send queries? Push query to data or pull data? How to divide the database? How to ensure correctness?

### 4. Partitioning Schemes

Distributed systems must partition the database across multiple resources. Goal: maximize single-node transactions.

- **Naive Data Partitioning:** One table per node. Doesn't scale.
- **Vertical Partitioning:** Split table attributes into separate partitions.
- **Horizontal Partitioning (most common):** Split tuples into disjoint subsets based on partitioning key(s). Logical partitioning (shared disk) vs. Physical partitioning (shared nothing).

### 5. Handling Cluster Size Changes

Problem with hash partitioning: adding/removing nodes shuffles lots of data.

- **Consistent Hashing:** Every node assigned location on logical ring. Hash of partition key maps to ring location. When node added/removed, only 1/n fraction of keys moved. Replication factor k means each key replicated at k closest nodes.
- **Rendezvous Hashing:** Compute hash score for every partition per key, choose partition with highest score. Stable mappings when nodes join/leave.

### 6. Distributed Concurrency Control

- **Centralized Coordinator:** Global 'traffic cop'. Can be middleware accepting and routing queries.
- **Decentralized Coordinator:** Client sends to one node (leader). Leader communicates with other partitions and returns results.

### 7. Federated Databases

Connect multiple DBMSs into a single logical system.

**Challenges:** Different data models, query languages, limitations. No easy optimization. Lots of data copying.

---

## Lecture 24: Distributed Database Systems II

*Source: 24-distributed2.pdf*

### 1. OLTP vs. OLAP

- **OLTP:** Short-lived read/write transactions, small footprint, repetitive operations.
- **OLAP:** Long-running read-only queries, complex joins, exploratory queries.

### 2. Atomic Commit Protocols

When a multi-node transaction finishes, the DBMS needs to ask all nodes whether it's safe to commit.

**Protocols:** Two-Phase Commit (1970s), Three-Phase Commit (1983), Viewstamped Replication (1988), Paxos (1989), ZAB (2008), Raft (2013).

**Required Properties:**

- Stability: Once fate decided, it cannot change.
- Consistency: All RMs end in same state, even after failures.
- Liveness: Protocol must always have a way of progressing forward.

### 3. Two-Phase Commit

Preferred when nodes are in same data center, don't fail often, and aren't malicious.

**Phase 1 - Prepare:** Coordinator sends Prepare. Participants send OK if valid, or Abort.

**Phase 2 - Commit:** If all OK, coordinator sends Commit. If any aborted, coordinator sends Abort.

**Properties:** Either all commit or none. All nodes keep non-volatile log. Blocking protocol.

**Failure Handling:**

- Coordinator crash: Participants decide (safe option: abort, or communicate with each other).
- Participant crash: Coordinator assumes abort if no acknowledgment.

**Optimizations:**

- Early Prepare Voting: Last query to remote node returns vote with query result.
- Early Acknowledgment after Prepare: Acknowledge to client before commit phase finishes.

### 4. Paxos

More prevalent in modern systems. 2PC is a degenerate case of Paxos (2PC sets F=0, Paxos uses 2F+1 coordinators). Non-blocking if majority available.

**Process:**

1. Client sends Commit Request to proposer.
2. Proposer sends Propose to acceptors.
3. Acceptors send Agree (if no higher logical timestamp Agree sent) or Reject.
4. Once majority Agrees, proposer sends Commit.
5. Proposer waits for Accept from majority before confirming to client.

**Multi-Paxos:** Elect single leader for proposing changes. Skip propose phase. Renew leader periodically. Falls back to full Paxos on failure.

**Tip:** Use exponential backoff when retrying failed proposals to avoid dueling proposers.

### 5. CAP Theorem

Proposed by Eric Brewer, proved in 2002. Impossible for a distributed system to always be Consistent, Available, and Partition Tolerant. Only two can be chosen.

- **Consistency (Linearizability):** Once write completes, all future reads return that value or later write.
- **Availability:** All nodes that are up can satisfy all requests.
- **Partition Tolerance:** System operates correctly despite message loss between nodes.

**Consistency + Partition Tolerance:** Updates not allowed until majority reconnected. Typical for traditional/NewSQL DBMSs.

**PACELC Theorem:** Modern version. In case of network Partitioning (P), choose between Availability (A) and Consistency (C); Else (E) when running normally, choose between Latency (L) and Consistency (C).

### 6. Distributed Join Algorithms

For analytical workloads, majority of time is spent computing joins and reading from disk.

**Principle:** Get proper tuples on same node to execute join. Always send minimal amount needed.

**Scenarios:**

1. One table replicated, other partitioned. Each node joins local data in parallel.
2. Both partitioned on join attribute with matching IDs. Each node joins locally.
3. **Broadcast Join:** Both partitioned on different keys. If one small, broadcast it to all nodes.
4. **Shuffle Join:** Worst case. Neither partitioned on join key. Repartition via shuffle operator.

**Optimizations:**

- **Semi-Join Filter:** Before pulling data from another node, use filter (e.g., Bloom filter) to reduce data movement.
- **Shuffle Operation:** Rebalance data based on observed characteristics. Basically the repartition type of exchange operator.
