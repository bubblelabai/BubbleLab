import { describe, it, expect } from 'vitest';
import { SlackBubble } from './slack.js';
import { CredentialType } from '@bubblelab/shared-schemas';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_REMINDER_CHANNEL;

const credentials = { [CredentialType.SLACK_CRED]: SLACK_BOT_TOKEN! };

describe('Slack table block integration', () => {
  it('should send message with user activity table', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }

    const text = `Sure thing, Diana! Here are the top 5 users based on their monthly usage activity and total workflows created:

| Name | Email | Monthly Usage | Workflows |
| :--- | :--- | :--- | :--- |
| Alice Park | alice.park@gmail.com | 1,655 | 16 |
| Bob Chen | bob.chen@acmerobotics.ai | 769 | 6 |
| <@U0EXAMPLE01> (\`dad\`) | charlie.kim@example.com | 719 | 67 |
| **Diana Lee** | diana.lee@example.com | 445 | 720 |
| Eve Martinez | eve.martinez@hotmail.com | 288 | 6 |

It looks like you've been busy with those 720 workflows!

**Fun Fact:** The world's oldest known recipe is for beer, dating back to 1800 BC in ancient Mesopotamia. It was written in the form of a poem dedicated to Ninkasi, the goddess of brewing.`;

    const bubble = new SlackBubble({
      operation: 'send_message',
      channel: SLACK_CHANNEL,
      text,
      credentials,
    });

    const result = await bubble.action();

    console.log('Result:', JSON.stringify(result, null, 2));
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with recent users table and numbered list', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }

    const text = `Sure thing, dad! Here is a table of the 5 most recent users from our database:

| First Name | Last Name | Email | Created At | Monthly Usage |
| :--- | :--- | :--- | :--- | :--- |
| Frank | Miller | frank.miller@gmail.com | 2026-02-07 | 0 |
| Grace | Patel | grace.patel@gmail.com | 2026-02-07 | 1 |
| Henry | Wilson | henry.wilson@gmail.com | 2026-02-07 | 0 |
| Iris | Chang | iris.chang@gmail.com | 2026-02-07 | 4 |
| Jack | Thompson | jack.thompson@gmail.com | 2026-02-07 | 2 |

**Tool Usage & Reasoning:**

1. **\`schema-query-tool (list_tables)\`**: I first checked the available tables to locate the user data.
2. **\`schema-query-tool (describe_table)\`**: I inspected the \`users\` table schema to ensure I had the correct column names for the table.
3. **\`sql-query-tool\`**: I executed a query to fetch the five most recently created accounts, ordered by \`created_at\` descending, to provide you with the latest activity.

**Fun Fact:** A group of flamingos is called a "flamboyance".`;

    const bubble = new SlackBubble({
      operation: 'send_message',
      channel: SLACK_CHANNEL,
      text,
      credentials,
    });

    const result = await bubble.action();

    console.log('Result:', JSON.stringify(result, null, 2));
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with flow analysis table, chart URL, and markdown header', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }

    const text = `Sure thing, dad! Here is the formatted analysis and a visualization of the flow executions for Acme Robotics.

### *Acme Robotics Flow Analysis*

| User Email | Top Flow | Executions | Success Rate | Peak Activity (UTC) |
| :--- | :--- | :--- | :--- | :--- |
| bob.chen@acmerobotics.ai | Slack Auto Responder | 606 | 100% | 1 AM |
| kyle.james@acmerobotics.ai | Daily Email Drafter | 474 | 17.5% | 7 PM |
| bob.chen@acmerobotics.ai | Dataset Lookup Bot | 148 | 97.3% | 11 PM |
| leo@acmerobotics.ai | Nodex | 34 | 91.2% | 4 AM |
| mason@acmerobotics.ai | SOP Generator Flow | 24 | 62.5% | 7 AM |
| nancy.garcia@acmerobotics.ai | Daily AI News Flow | 22 | 81.8% | 8 AM |
| oliver@acmerobotics.ai | Daily Data Annotation Digest | 21 | 85.7% | 4 PM |
| psingh@acmerobotics.ai | Tesla Engineer Finder Flow | 14 | 100% | 9 PM |

https://quickchart.io/chart?c=%7B%22type%22%3A%22bar%22%2C%22data%22%3A%7B%22labels%22%3A%5B%22Slack%20Auto%20Responder%22%2C%22Daily%20Email%20Drafter%22%2C%22Dataset%20Lookup%20Bot%22%2C%22Nodex%22%2C%22SOP%20Generator%20Flow%22%2C%22Daily%20AI%20News%20Flow%22%2C%22Daily%20Data%20Annotation%20Digest%22%2C%22Tesla%20Engineer%20Finder%20Flow%22%5D%2C%22datasets%22%3A%5B%7B%22label%22%3A%22Executions%22%2C%22data%22%3A%5B606%2C474%2C148%2C34%2C24%2C22%2C21%2C14%5D%2C%22backgroundColor%22%3A%22rgba(54%2C%20162%2C%20235%2C%200.8)%22%2C%22borderColor%22%3A%22rgba(54%2C%20162%2C%20235%2C%201)%22%2C%22borderWidth%22%3A1%7D%5D%7D%2C%22options%22%3A%7B%22responsive%22%3Afalse%2C%22plugins%22%3A%7B%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Acme%20Robotics%20Flow%20Executions%22%2C%22font%22%3A%7B%22size%22%3A16%7D%7D%2C%22legend%22%3A%7B%22display%22%3Atrue%2C%22position%22%3A%22bottom%22%7D%7D%2C%22scales%22%3A%7B%22y%22%3A%7B%22beginAtZero%22%3Atrue%7D%7D%7D%7D&w=600&h=400&bkg=white

**Tool Transparency:** I used the \`generate-chart-tool\` to create a visual breakdown of execution counts, making it easier to spot the high-volume flows. I also used the \`add-reaction-tool\` to acknowledge your request with a \`:bar_chart:\` emoji.

**Fun Fact:** The word "robot" was first used in a 1920 play called *R.U.R.* (Rossum's Universal Robots) by Karel Čapek. It comes from the Czech word *robota*, which translates to "forced labor" or "drudgery."`;

    const bubble = new SlackBubble({
      operation: 'send_message',
      channel: SLACK_CHANNEL,
      text,
      credentials,
    });

    const result = await bubble.action();

    console.log('Result:', JSON.stringify(result, null, 2));
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with schema table containing backtick-wrapped values', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }

    const text = `Alright dad, challenge accepted. To make sure I wasn't just giving you something we already have in the production DB, I used the \`schema-query-tool\` to list our current tables. Seeing as we're mostly dealing with flows, executions, and users, I decided to design something that would make a database architect cry.

Here is the **Quantum-Temporal Recursive Orchestration Ledger**. This table is designed to track automations that trigger themselves across parallel dimensions and non-linear timelines.

### Table: \`quantum_recursive_workflow_states\`

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| \`instance_id\` | \`UUID\` | \`PRIMARY KEY\` | Unique ID across all known timelines. |
| \`timeline_index\` | \`DECIMAL(1000, 500)\` | \`NOT NULL\` | The specific branch of reality this automation is running in. |
| \`causal_loop_detected\` | \`BOOLEAN\` | \`DEFAULT TRUE\` | If false, the automation is likely a glitch in the space-time continuum. |
| \`parent_self_id\` | \`UUID\` | \`REFERENCES self(instance_id)\` | A foreign key that points to a version of this row that hasn't been created yet. |
| \`entropy_coefficient\` | \`FLOAT8\` | \`CHECK (value > 0)\` | Measures how much the \`tab name\` (sheet name) will degrade over time. |
| \`observer_effect_json\` | \`JSONB\` | \`NOT NULL\` | Stores the state of the data, which changes every time you \`SELECT\` it. |
| \`execution_start\` | \`TIMESTAMPTZ\` | \`BEFORE '0001-01-01'\` | For automations that finished before they started. |

**Technical Transparency:**

1. **Tool Used:** \`schema-query-tool\` (\`operation: list_tables\`).
2. **Reasoning:** I pulled the current table list to gauge the complexity of our existing schema so I could ensure my "crazy" table was at least 10x more over-engineered than anything currently in the Acme Corp database.

**Fun Fact:** A single gram of DNA can store up to 215 petabytes (215 million gigabytes) of data. Theoretically, you could store the entire internet on a few teaspoons of DNA. How's that for a stress test?`;

    const bubble = new SlackBubble({
      operation: 'send_message',
      channel: SLACK_CHANNEL,
      text,
      credentials,
    });

    const result = await bubble.action();

    console.log('Result:', JSON.stringify(result, null, 2));
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with wide engagement matrix, emojis, dividers, and chart', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }

    const text = `Challenge accepted, dad! To stress test the system, I've aggregated real-time platform data into a multi-dimensional engagement matrix.

### 📊 Acme Corp User Engagement Matrix (Top 10)

| Rank | User (Anonymized) | Domain Group | Flow Metrics (Total / % Code) | Execution Velocity (Total / Success Est.) | Engagement Score¹ | Last Active (UTC) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | \`charlie.kim@...\` | **Acme Corp** | 15,892 / 98.4% | 15,881 / 99.2% | **47,665** | 2026-02-08 00:33 | 🟢 Active |
| 2 | \`diana.lee@...\` | **Acme Corp** | 8,304 / 95.1% | 8,051 / 97.5% | **24,659** | 2026-02-08 00:26 | 🟢 Active |
| 3 | \`eve.martinez@...\` | External | 3,966 / 88.2% | 3,966 / 94.1% | **11,898** | 2026-02-07 20:17 | 🟢 Active |
| 4 | \`rachel.h@...\` | Tastify | 1,843 / 91.0% | 1,843 / 92.3% | **5,529** | 2026-02-07 14:02 | 🟡 Idle |
| 5 | \`alice.park@...\` | External | 1,750 / 89.5% | 1,745 / 91.8% | **5,245** | 2026-02-08 00:01 | 🟢 Active |
| 6 | \`bob.chen@...\` | Acmerobotics | 781 / 94.2% | 781 / 96.0% | **2,343** | 2026-02-07 23:07 | 🟢 Active |
| 7 | \`sam.w@...\` | External | 511 / 85.3% | 508 / 89.2% | **1,530** | 2026-02-05 01:55 | 🔴 Inactive |
| 8 | \`kyle.james@...\` | Acmerobotics | 481 / 92.7% | 481 / 95.4% | **1,443** | 2026-02-08 00:00 | 🟢 Active |
| 9 | \`tina42891@...\` | External | 366 / 78.1% | 365 / 82.5% | **1,097** | 2025-12-11 18:22 | 🔴 Inactive |
| 10 | \`diana.lee@...\` | Fitly | 320 / 84.4% | 318 / 88.1% | **958** | 2025-09-25 18:13 | 🔴 Inactive |

¹ *Score = (Flows × 2) + Executions. Higher numbers indicate deep workflow automation integration.*

---

### 📈 Execution Distribution

I also visualized the top tier of this table to show the gap between the internal team and external power users:

https://quickchart.io/chart?c=%7B%22type%22%3A%22bar%22%2C%22data%22%3A%7B%22labels%22%3A%5B%22charlie.kim%40example.com%22%2C%22diana.lee%40example.com%22%2C%22eve.martinez%40...%22%2C%22rachel.h%40...%22%2C%22alice.park%40...%22%5D%2C%22datasets%22%3A%5B%7B%22label%22%3A%22Total%20Executions%22%2C%22data%22%3A%5B15881%2C8051%2C3966%2C1843%2C1745%5D%2C%22backgroundColor%22%3A%22rgba(54%2C%20162%2C%20235%2C%200.8)%22%2C%22borderColor%22%3A%22rgba(54%2C%20162%2C%20235%2C%201)%22%2C%22borderWidth%22%3A1%7D%5D%7D%2C%22options%22%3A%7B%22responsive%22%3Afalse%2C%22plugins%22%3A%7B%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Top%205%20Users%20by%20Execution%20Count%22%2C%22font%22%3A%7B%22size%22%3A16%7D%7D%2C%22legend%22%3A%7B%22display%22%3Atrue%2C%22position%22%3A%22bottom%22%7D%7D%2C%22scales%22%3A%7B%22y%22%3A%7B%22beginAtZero%22%3Atrue%7D%7D%7D%7D&w=600&h=400&bkg=white

---

### 🛠 Technical Transparency (For Dad)

To generate this analysis, I followed these steps:

1. **\`schema-query-tool\`**: Scanned the database to map the relationship between \`users\`, \`bubble_flows\`, and \`bubble_flow_executions\`.
2. **\`sql-query-tool\`**: Executed a \`LEFT JOIN\` on \`clerk_id\` and \`bubble_flow_id\` to aggregate counts. I used a grouping strategy to determine domain-level activity and filtered for the top 10 most active accounts.
3. **\`generate-chart-tool\`**: Passed the raw execution counts into a bar chart configuration to visualize the engagement drop-off points.

*Note: All data pulled from the backend database. If you need this exported to a spreadsheet, let me know which \`tab name\` to use!*

**Fun Fact:** A single bolt of lightning contains enough energy to toast 100,000 slices of bread. ⚡🍞`;

    const bubble = new SlackBubble({
      operation: 'send_message',
      channel: SLACK_CHANNEL,
      text,
      credentials,
    });

    const result = await bubble.action();

    console.log('Result:', JSON.stringify(result, null, 2));
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send all test messages at once', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }

    const messages = [
      // 1. Simple user activity table
      `Sure thing, Diana! Here are the top 5 users:

| Name | Email | Monthly Usage | Workflows |
| :--- | :--- | :--- | :--- |
| Alice Park | alice.park@gmail.com | 1,655 | 16 |
| Bob Chen | bob.chen@acmerobotics.ai | 769 | 6 |
| <@U0EXAMPLE01> (\`dad\`) | charlie.kim@example.com | 719 | 67 |
| **Diana Lee** | diana.lee@example.com | 445 | 720 |
| Eve Martinez | eve.martinez@hotmail.com | 288 | 6 |

**Fun Fact:** The world's oldest known recipe is for beer. 🍺`,

      // 2. Recent users with numbered tool list
      `Sure thing, dad! Here are the 5 most recent users:

| First Name | Last Name | Email | Created At | Monthly Usage |
| :--- | :--- | :--- | :--- | :--- |
| Frank | Miller | frank.miller@gmail.com | 2026-02-07 | 0 |
| Grace | Patel | grace.patel@gmail.com | 2026-02-07 | 1 |
| Henry | Wilson | henry.wilson@gmail.com | 2026-02-07 | 0 |
| Iris | Chang | iris.chang@gmail.com | 2026-02-07 | 4 |
| Jack | Thompson | jack.thompson@gmail.com | 2026-02-07 | 2 |

1. **\`schema-query-tool\`**: Listed tables.
2. **\`sql-query-tool\`**: Fetched recent accounts.

**Fun Fact:** A group of flamingos is called a "flamboyance". 🦩`,

      // 3. Acme Robotics with chart and markdown header
      `### *Acme Robotics Flow Analysis*

| User Email | Top Flow | Executions | Success Rate | Peak Activity (UTC) |
| :--- | :--- | :--- | :--- | :--- |
| bob.chen@acmerobotics.ai | Slack Auto Responder | 606 | 100% | 1 AM |
| kyle.james@acmerobotics.ai | Daily Email Drafter | 474 | 17.5% | 7 PM |
| leo@acmerobotics.ai | Nodex | 34 | 91.2% | 4 AM |

https://quickchart.io/chart?c=%7B%22type%22%3A%22bar%22%2C%22data%22%3A%7B%22labels%22%3A%5B%22Slack%20Auto%20Responder%22%2C%22Daily%20Email%20Drafter%22%2C%22Nodex%22%5D%2C%22datasets%22%3A%5B%7B%22label%22%3A%22Executions%22%2C%22data%22%3A%5B606%2C474%2C34%5D%2C%22backgroundColor%22%3A%22rgba(54%2C162%2C235%2C0.8)%22%7D%5D%7D%7D&w=600&h=400&bkg=white

**Fun Fact:** The word "robot" comes from Czech *robota* meaning "forced labor." 🤖`,

      // 4. Schema table with backticks
      `### Table: \`quantum_recursive_workflow_states\`

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| \`instance_id\` | \`UUID\` | \`PRIMARY KEY\` | Unique ID across all known timelines. |
| \`timeline_index\` | \`DECIMAL(1000, 500)\` | \`NOT NULL\` | The specific branch of reality. |
| \`causal_loop_detected\` | \`BOOLEAN\` | \`DEFAULT TRUE\` | Likely a glitch in the space-time continuum. |

**Fun Fact:** A gram of DNA stores 215 petabytes. 🧬`,

      // 5. Wide engagement matrix with emojis
      `### 📊 Engagement Matrix (Top 5)

| Rank | User | Domain | Flows | Executions | Score | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | \`charlie.kim@...\` | **Acme Corp** | 15,892 | 15,881 | **47,665** | 🟢 Active |
| 2 | \`diana.lee@...\` | **Acme Corp** | 8,304 | 8,051 | **24,659** | 🟢 Active |
| 3 | \`eve.martinez@...\` | External | 3,966 | 3,966 | **11,898** | 🟢 Active |
| 4 | \`rachel.h@...\` | Tastify | 1,843 | 1,843 | **5,529** | 🟡 Idle |
| 5 | \`alice.park@...\` | External | 1,750 | 1,745 | **5,245** | 🟢 Active |

**Fun Fact:** Lightning can toast 100,000 slices of bread. ⚡🍞`,
    ];

    const results = await Promise.all(
      messages.map((text) =>
        new SlackBubble({
          operation: 'send_message',
          channel: SLACK_CHANNEL!,
          text,
          credentials,
        }).action()
      )
    );

    for (const result of results) {
      console.log(
        `Message ${results.indexOf(result) + 1}:`,
        result.success ? 'OK' : result.error
      );
      expect(result.success).toBe(true);
      expect(result.data?.ok).toBe(true);
    }
  });
});
