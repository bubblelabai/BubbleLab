import { markdownToHtml } from './markdown-to-html';

describe('markdownToHtml', () => {
  it('should hide URL and show only link text for QuickChart links', () => {
    const markdown = `#### **1. DAU Trend: Consistent Growth**

The Daily Active User count has shown significant growth over the past month.

**[View DAU Trend Chart](https://quickchart.io/chart?c=%7B%22type%22%3A%22line%22%2C%22data%22%3A%7B%22labels%22%3A%5B%222026-01-09%22%2C%222026-01-10%22%2C%222026-01-11%22%2C%222026-01-12%22%2C%222026-01-13%22%2C%222026-01-14%22%2C%222026-01-15%22%2C%222026-01-16%22%2C%222026-01-17%22%2C%222026-01-18%22%2C%222026-01-19%22%2C%222026-01-20%22%2C%222026-01-21%22%2C%222026-01-22%22%2C%222026-01-23%22%2C%222026-01-24%22%2C%222026-01-25%22%2C%222026-01-26%22%2C%222026-01-27%22%2C%222026-01-28%22%2C%222026-01-29%22%2C%222026-01-30%22%2C%222026-01-31%22%2C%222026-02-01%22%2C%222026-02-02%22%2C%222026-02-03%22%2C%222026-02-04%22%2C%222026-02-05%22%2C%222026-02-06%22%2C%222026-02-07%22%2C%222026-02-08%22%5D%2C%22datasets%22%3A%5B%7B%22label%22%3A%22Daily%20Active%20Users%20(DAU)%22%2C%22data%22%3A%5B81%2C74%2C70%2C73%2C88%2C73%2C74%2C71%2C70%2C105%2C140%2C118%2C117%2C109%2C103%2C91%2C105%2C123%2C108%2C116%2C114%2C106%2C109%2C125%2C150%2C126%2C122%2C119%2C118%2C104%2C112%5D%2C%22backgroundColor%22%3A%22rgba(54%2C%20162%2C%20235%2C%200.8)%22%2C%22borderColor%22%3A%22rgba(54%2C%20162%2C%20235%2C%201)%22%2C%22borderWidth%22%3A1%2C%22fill%22%3Afalse%7D%5D%7D%2C%22options%22%3A%7B%22responsive%22%3Afalse%2C%22plugins%22%3A%7B%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Daily%20Active%20Users%20(DAU)%20-%20Last%2030%20Days%22%2C%22font%22%3A%7B%22size%22%3A16%7D%7D%2C%22legend%22%3A%7B%22display%22%3Atrue%2C%22position%22%3A%22bottom%22%7D%7D%2C%22scales%22%3A%7B%22y%22%3A%7B%22beginAtZero%22%3Atrue%7D%7D%7D%7D&w=600&h=400&bkg=white)**

---

#### **2. Growth Drivers: Retention is Key**`;

    const html = markdownToHtml(markdown);

    // Should contain the link with proper href
    expect(html).toContain(
      '<a href="https://quickchart.io/chart?c=%7B%22type%22%3A%22line%22'
    );

    // The link should contain the URL in href and text should be visible
    expect(html).toContain('View DAU Trend Chart');
    expect(html).toContain('href="https://quickchart.io/chart');

    // The link should be complete and not leak into the next section
    expect(html).toContain('</a>');

    // Should have proper sections separated by hr
    expect(html).toContain('<hr>');
    expect(html).toContain(
      '<h4><strong>2. Growth Drivers: Retention is Key</strong></h4>'
    );

    // Verify the link structure: URL should be hidden, only link text visible
    // The link should close before the horizontal rule
    const linkEndIndex = html.indexOf('</a>');
    const hrIndex = html.indexOf('<hr>');
    expect(linkEndIndex).toBeLessThan(hrIndex);

    console.log('\n=== Generated HTML ===\n', html, '\n');
  });

  it('should correctly parse markdown with long URLs in links', () => {
    const markdown = `## Database Analysis Report

**Question:** DAU

---

**Analyzing User Activity: MAU, Stickiness, and Event Drivers**

Okay, so I have the Daily Active User (DAU) trend in front of me, which is a good start. My next step is to calculate the Monthly Active Users (MAU) and, from that, derive the Stickiness (DAU/MAU) metric. The definition is clear: MAU is the count of unique users active within the last 30 days. And the Average DAU will simply be the mean of the DAU values I've already calculated. That part's straightforward.

Beyond the raw numbers, I want to understand what's *driving* this activity. I'll need to dig into the \`bubble_flows\` data, specifically looking for whether this increased user engagement is tied to a particular \`event_type\`. Is there one core action that's responsible, or is the activity spread more broadly across various event types? Understanding the event-level impact is key for optimization.

Finally, I'm going to look for any "power users," those individuals with extremely high execution counts. Identifying these users can reveal a lot about the application's core appeal. They're often outliers, but their behavior holds valuable insights.

Let's start with calculating the MAU, then we can move on to the rest.

**Diving Deeper into User Engagement**

Okay, I've got the DAU trend, and it's looking good. Now, I want to take it a step further and calculate the MAU (Monthly Active Users) and the Stickiness ratio (DAU/MAU). This will give me a much clearer picture of how engaged our users really are.

To get the MAU, I'll count the unique users who have been active at any point in the last 30 days. Then, I'll take the average of the DAU values I just calculated. Dividing that average DAU by the MAU will give me the stickiness ratio – a key metric for understanding user retention and habit formation.

I'm also curious about what's driving this activity. I'll check the \`bubble_flows\` table to see if there's a specific \`event_type\` that's particularly popular, or if the activity is more evenly sead.

And while I'm at it, I'll look for "power users" – those individuals with exceptionally high execution counts. Identifying them could provide some really valuable insights.

So, first step: calculate the MAU. Let's get to it.

### DAU Analysis Report (Last 30 Days)

The platform has experienced a **48% growth in Daily Active Users (DAU)** over the last month, rising from an average of 75 users per day in early January to a peak of 150 in early February.

#### Key Insights:

* **Growth Trend:** There was a significant step-change in activity around **January 19th**, where DAU jumped from ~70 to over 100 and has remained above that baseline since.
* **Peak Activity:** The highest activity was recorded on **February 2nd, 2026**, with 150 unique active users.
* **Stability:** The "new normal" for the platform appears to be between 110-120 DAU, compared to the 70-80 range seen at the start of the period.

[**View DAU Trend Chart**](https://quickchart.io/chart?c=%7B%22type%22%3A%22line%22%2C%22data%22%3A%7B%22lals%22%3A%5B%222026-01-08%22%2C%222026-01-09%22%2C%222026-01-10%22%2C%222026-01-11%22%2C%222026-01-12%22%2C%222026-01-13%22%2C%222026-01-14%22%2C%222026-01-15%22%2C%222026-01-16%22%2C%222026-01-17%22%2C%222026-01-18%22%2C%222026-01-19%22%2C%222026-01-20%22%2C%222026-01-21%22%2C%222026-01-22%22%2C%222026-01-23%22%2C%222026-01-24%22%2C%222026-01-25%22%2C%222026-01-26%22%2C%222026-01-27%22%2C%222026-01-28%22%2C%222026-01-29%22%2C%222026-01-30%22%2C%222026-01-31%22%2C%222026-02-01%22%2C%222026-02-02%22%2C%222026-02-03%22%2C%222026-02-04%22%2C%222026-02-05%22%2C%222026-02-06%22%2C%222026-02-07%22%2C%222026-02-08%22%5D%2C%22datasets%22%3A%5B%7B%22label%22%3A%22Daily%20Active%20Users%20(DAU)%22%2C%22data%22%3A%5B86%2C81%2C74%2C70%2C73%2C88%2C73%2C74%2C71%2C70%2C105%2C140%2C118%2C117%2C109%2C103%2C91%2C105%2C123%2C108%2C116%2C114%2C106%2C109%2C125%2C150%2C126%2C122%2C119%2C118%2C104%2C111%5D%2C%22backgroundColor%22%3A%22rgba(54%2C%20162%2C%20235%2C%200.8)%22%2C%22borderColor%22%3A%22rgba(54%2C%20162%2C%20235%2C%201)%22%2C%22borderWidth%22%3A1%2C%22fill%22%3Afalse%7D%5D%7D%2C%22options%22%3A%7B%22responsive%22%3Afalse%2C%22plugins%22%3A%7B%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Daily%20Active%20Users%20(Last%2030%20Days)%22%2C%22font%22%3A%7B%22size%22%3A16%7D%7D%2C%22legend%22%3A%7B%22display%22%3Atrue%2C%22position%22%3A%22bottom%22%7D%7D%2C%22scales%22%3A%7B%22y%22%3A%7B%22beginAtZero%22%3Atrue%7D%7D%7D%7D&w=600&h=400&bkg=white)

#### Follow-up Analysis Suggestions:

1. **Stickiness (DAU/MAU):** I can calculate the Monthly Active Users (MAU) to determine how many users are returning consistently versus trying the platform once.
2. **Feature Adoption:** We could analyze which \`event_types\` or specific \`bubble_flows\` are driving the most executions to see what's powering this growth.
3. **Power User Identification:** Identifying the top 5% of users by execution volume could help in understanding high-value use cases.

Would you like me to calculate the **Stickiness (DAU/MAU)** ratio or identify the **top-performing flows** next?`;

    const html = markdownToHtml(markdown);

    // The link should be properly parsed (note: & is escaped to &amp; in HTML)
    expect(html).toContain(
      '<a href="https://quickchart.io/chart?c=%7B%22type%22%3A%22line%22%2C%22data%22%3A%7B%22lals%22%3A%5B%222026-01-08%22%2C%222026-01-09%22%2C%222026-01-10%22%2C%222026-01-11%22%2C%222026-01-12%22%2C%222026-01-13%22%2C%222026-01-14%22%2C%222026-01-15%22%2C%222026-01-16%22%2C%222026-01-17%22%2C%222026-01-18%22%2C%222026-01-19%22%2C%222026-01-20%22%2C%222026-01-21%22%2C%222026-01-22%22%2C%222026-01-23%22%2C%222026-01-24%22%2C%222026-01-25%22%2C%222026-01-26%22%2C%222026-01-27%22%2C%222026-01-28%22%2C%222026-01-29%22%2C%222026-01-30%22%2C%222026-01-31%22%2C%222026-02-01%22%2C%222026-02-02%22%2C%222026-02-03%22%2C%222026-02-04%22%2C%222026-02-05%22%2C%222026-02-06%22%2C%222026-02-07%22%2C%222026-02-08%22%5D%2C%22datasets%22%3A%5B%7B%22label%22%3A%22Daily%20Active%20Users%20(DAU)%22%2C%22data%22%3A%5B86%2C81%2C74%2C70%2C73%2C88%2C73%2C74%2C71%2C70%2C105%2C140%2C118%2C117%2C109%2C103%2C91%2C105%2C123%2C108%2C116%2C114%2C106%2C109%2C125%2C150%2C126%2C122%2C119%2C118%2C104%2C111%5D%2C%22backgroundColor%22%3A%22rgba(54%2C%20162%2C%20235%2C%200.8)%22%2C%22borderColor%22%3A%22rgba(54%2C%20162%2C%20235%2C%201)%22%2C%22borderWidth%22%3A1%2C%22fill%22%3Afalse%7D%5D%7D%2C%22options%22%3A%7B%22responsive%22%3Afalse%2C%22plugins%22%3A%7B%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Daily%20Active%20Users%20(Last%2030%20Days)%22%2C%22font%22%3A%7B%22size%22%3A16%7D%7D%2C%22legend%22%3A%7B%22display%22%3Atrue%2C%22position%22%3A%22bottom%22%7D%7D%2C%22scales%22%3A%7B%22y%22%3A%7B%22beginAtZero%22%3Atrue%7D%7D%7D%7D&amp;w=600&amp;h=400&amp;bkg=white">'
    );
    expect(html).toContain('<strong>View DAU Trend Chart</strong>');

    // Verify headers are parsed
    expect(html).toContain('<h2>Database Analysis Report</h2>');
    expect(html).toContain('<h3>DAU Analysis Report (Last 30 Days)</h3>');
    expect(html).toContain('<h4>Key Insights:</h4>');
    expect(html).toContain('<h4>Follow-up Analysis Suggestions:</h4>');

    // Verify inline code is parsed
    expect(html).toContain('<code>bubble_flows</code>');
    expect(html).toContain('<code>event_type</code>');

    // Verify lists are parsed
    expect(html).toContain('<ul>');
    expect(html).toContain('<ol>');

    // Verify bold text
    expect(html).toContain(
      '<strong>48% growth in Daily Active Users (DAU)</strong>'
    );

    // Verify italic text
    expect(html).toContain('<em>driving</em>');

    // Verify horizontal rule
    expect(html).toContain('<hr>');
  });
});
