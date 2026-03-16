### Error Distribution (Last 100)

![Error Chart](<https://quickchart.io/chart?c=%7B%22type%22%3A%22bar%22%2C%22data%22%3A%7B%22labels%22%3A%5B%22create-flow%22%2C%22linkedin%22%2C%22edit-flow%22%2C%22run-flow%22%2C%22get-trigger-detail%22%2C%22web-scrape-tool%22%2C%22manage_capability%22%2C%22web-crawl-tool%22%2C%22list-channels%22%2C%22get-user%22%2C%22get-flow%22%2C%22edit-flow-code%22%2C%22search-emails%22%2C%22query-trace%22%2C%22initiate-oauth%22%2C%22create-doc%22%2C%22twitter%22%2C%22search-records%22%5D%2C%22datasets%22%3A%5B%7B%22label%22%3A%22Error%20Count%22%2C%22data%22%3A%5B24%2C17%2C16%2C15%2C5%2C3%2C3%2C2%2C2%2C2%2C2%2C2%2C2%2C1%2C1%2C1%2C1%2C1%5D%2C%22backgroundColor%22%3A%22rgba(255%2C%2099%2C%20132%2C%200.7)%22%2C%22borderColor%22%3A%22rgba(255%2C%2099%2C%20132%2C%201)%22%2C%22borderWidth%22%3A1%7D%5D%7D%2C%22options%22%3A%7B%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Last%20100%20Tool%20Errors%20by%20Tool%20Name%22%7D%2C%22scales%22%3A%7B%22yAxes%22%3A%5B%7B%22ticks%22%3A%7B%22beginAtZero%22%3Atrue%2C%22precision%22%3A0%7D%7D%5D%7D%7D%7D>)

### Detailed Error Log

| Time (PDT)       | Tool                 | Error Summary                                                                                                                 | Trace ID |
| :--------------- | :------------------- | :---------------------------------------------------------------------------------------------------------------------------- | :------- |
| Mar 15, 10:08 PM | `create-flow`        | Code validation failed: line 47: TS2352: Conversion of type 'Record<string, unknown>[]' to type 'ToolErrorRow[]' may ...      | 10627    |
| Mar 15, 10:07 PM | `query-trace`        | Step 4 not found in steps view                                                                                                | 10627    |
| Mar 15, 6:11 PM  | `get-trigger-detail` | Invalid trigger type 'zendesk/ticket_created'. Valid types are: slack/message_received, slack/bot_mentioned, slack/re...      | 10363    |
| Mar 15, 7:48 AM  | `run-flow`           | This action requires human approval. An approval request has been sent. Please wait for the user to approve or deny t...      | 9733     |
| Mar 15, 7:48 AM  | `create-flow`        | Code validation failed: line 79: TS2352: Conversion of type '{ id: string \| null; photo: string \| null; verified: boo...    | 9733     |
| Mar 15, 7:47 AM  | `get-trigger-detail` | Invalid trigger type 'cron'. Valid types are: slack/message_received, slack/bot_mentioned, slack/reaction_added, slac...      | 9733     |
| Mar 15, 7:41 AM  | `create-flow`        | Code validation failed: line 35: TS2352: Conversion of type 'Record<string, unknown>[]' to type 'UserRow[]' may be a ...      | 9723     |
| Mar 15, 6:27 AM  | `create-flow`        | Code validation failed: line 31: Method invocation 'this.formatTimestamp()' inside object property cannot be instrume...      | 9636     |
| Mar 15, 5:51 AM  | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost...    | 9590     |
| Mar 15, 4:50 AM  | `create-flow`        | Code validation failed: line 27: TS2345: Argument of type '(row: { email: string; first_name: string \| null; last_nam...     | 9519     |
| Mar 15, 4:20 AM  | `create-flow`        | Code validation failed: line 44: TS2352: Conversion of type 'Record<string, unknown>[]' to type 'FlowRecord[]' may be...      | 9501     |
| Mar 15, 4:14 AM  | `create-flow`        | Code validation failed: line 206: Method invocation 'this.formatTime()' inside ternary operator cannot be instrumente...      | 9494     |
| Mar 15, 2:04 AM  | `web-crawl-tool`     | Received tool input did not match expected schema                                                                             | 9344     |
| Mar 15, 2:04 AM  | `web-scrape-tool`    | Received tool input did not match expected schema                                                                             | 9344     |
| Mar 15, 2:04 AM  | `web-crawl-tool`     | Received tool input did not match expected schema                                                                             | 9344     |
| Mar 15, 12:05 AM | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost...    | 9228     |
| Mar 15, 12:04 AM | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost...    | 9228     |
| Mar 15, 12:03 AM | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost...    | 9237     |
| Mar 15, 12:03 AM | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost...    | 9228     |
| Mar 15, 12:01 AM | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost...    | 9237     |
| Mar 15, 12:01 AM | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost...    | 9228     |
| Mar 14, 3:19 PM  | `edit-flow`          | Received tool input did not match expected schema                                                                             | 8732     |
| Mar 14, 3:19 PM  | `edit-flow`          | Received tool input did not match expected schema                                                                             | 8732     |
| Mar 14, 3:19 PM  | `edit-flow`          | Received tool input did not match expected schema                                                                             | 8732     |
| Mar 14, 3:19 PM  | `edit-flow`          | Received tool input did not match expected schema                                                                             | 8732     |
| Mar 14, 3:16 PM  | `edit-flow`          | Received tool input did not match expected schema                                                                             | 8732     |
| Mar 14, 3:13 PM  | `edit-flow`          | Received tool input did not match expected schema                                                                             | 8732     |
| Mar 14, 3:10 PM  | `edit-flow`          | Received tool input did not match expected schema                                                                             | 8732     |
| Mar 14, 3:08 PM  | `edit-flow`          | Received tool input did not match expected schema                                                                             | 8732     |
| Mar 14, 3:05 PM  | `edit-flow`          | Received tool input did not match expected schema                                                                             | 8732     |
| Mar 14, 3:02 PM  | `edit-flow`          | Received tool input did not match expected schema                                                                             | 8710     |
| Mar 14, 2:59 PM  | `edit-flow`          | Received tool input did not match expected schema                                                                             | 8710     |
| Mar 14, 2:57 PM  | `edit-flow`          | Received tool input did not match expected schema                                                                             | 8710     |
| Mar 14, 2:54 PM  | `edit-flow`          | Received tool input did not match expected schema                                                                             | 8710     |
| Mar 14, 2:52 PM  | `edit-flow`          | Received tool input did not match expected schema                                                                             | 8710     |
| Mar 14, 2:48 PM  | `create-flow`        | Code validation failed: line 243: TS2322: Type '"get_values"' is not assignable to type '"read_values" \| "write_value...     | 8710     |
| Mar 14, 2:10 PM  | `edit-flow`          | Received tool input did not match expected schema                                                                             | 8687     |
| Mar 14, 12:26 PM | `get-trigger-detail` | Invalid trigger type 'cron/schedule'. Valid types are: slack/message_received, slack/bot_mentioned, slack/reaction_ad...      | 8585     |
| Mar 14, 12:18 PM | `run-flow`           | This action requires human approval. An approval request has been sent. Please wait for the user to approve or deny t...      | 8579     |
| Mar 14, 12:17 PM | `create-flow`        | Code validation failed: line 157: Method invocation 'this.draftRecruiterEmail()' inside ternary operator cannot be in...      | 8579     |
| Mar 14, 12:16 PM | `create-flow`        | Code validation failed: line 13: TS2430: Interface 'GmailPushPayload' incorrectly extends interface 'WebhookEvent'.\n ...     | 8579     |
| Mar 14, 12:14 PM | `get-trigger-detail` | Invalid trigger type 'gmail/message_received'. Valid types are: slack/message_received, slack/bot_mentioned, slack/re...      | 8579     |
| Mar 13, 5:01 PM  | `manage_capability`  | Validation failed: line 39: TS2339: Property 'sendSlackReply' does not exist on type 'SlackBotFlow'.; line 55: TS2355...      | 7864     |
| Mar 13, 4:52 PM  | `manage_capability`  | Validation failed: line 39: TS2339: Property 'sendSlackReply' does not exist on type 'SlackBotFlow'.; line 55: TS2355...      | 7846     |
| Mar 13, 8:44 AM  | `create-flow`        | Code validation failed: line 28: TS2345: Argument of type '(row: { email: string; first_name: string \| null; last_nam...     | 7475     |
| Mar 13, 7:55 AM  | `create-flow`        | Code validation failed: line 69: Method 'this.formatTimestamp()' cannot be called from another method. Methods should...      | 7409     |
| Mar 13, 7:54 AM  | `create-flow`        | Code validation failed: line 41: Method invocation 'this.formatTimestamp()' inside ternary operator cannot be instrum...      | 7409     |
| Mar 13, 7:52 AM  | `create-flow`        | Code validation failed: line 46: TS2352: Conversion of type 'Record<string, unknown>[]' to type 'UserRow[]' may be a ...      | 7403     |
| Mar 13, 7:52 AM  | `create-flow`        | Code validation failed: line 32: Type 'any' is not allowed. Use a specific type, 'unknown', or a generic type paramet...      | 7403     |
| Mar 13, 7:52 AM  | `initiate-oauth`     | Credential type GOOGLE_OAUTH_CRED not supported by provider google                                                            | 7402     |
| Mar 13, 7:52 AM  | `manage_capability`  | Capability "gmail-assistant" is already active. Use action "update_context" to modify its context.                            | 7402     |
| Mar 13, 7:50 AM  | `create-flow`        | Code validation failed: line 85: TS2322: Type '{ name: string; id: number; uuid?: string \| undefined; created_at?: st...     | 7396     |
| Mar 13, 7:43 AM  | `create-flow`        | Code validation failed: line 31: TS2352: Conversion of type 'Record<string, unknown>[]' to type 'UserRow[]' may be a ...      | 7388     |
| Mar 13, 7:37 AM  | `create-flow`        | Code validation failed: line 31: TS2352: Conversion of type 'Record<string, unknown>[]' to type 'UserRow[]' may be a ...      | 7377     |
| Mar 13, 7:36 AM  | `run-flow`           | r.created_at_pdt?.startsWith is not a function. (In 'r.created_at_pdt?.startsWith(todayPrefix)', 'r.created_at_pdt?.s...      | 7370     |
| Mar 13, 7:36 AM  | `run-flow`           | r.created_at_pdt?.startsWith is not a function. (In 'r.created_at_pdt?.startsWith(todayPrefix)', 'r.created_at_pdt?.s...      | 7370     |
| Mar 13, 7:33 AM  | `run-flow`           | Bubble execution failed at postgresql (variableId: 424784): column "name" does not exist                                      | 7362     |
| Mar 13, 6:19 AM  | `run-flow`           | This action requires human approval. An approval request has been sent. Please wait for the user to approve or deny t...      | 7306     |
| Mar 13, 5:59 AM  | `create-doc`         | Received tool input did not match expected schema                                                                             | 7279     |
| Mar 13, 1:05 AM  | `twitter`            | Received tool input did not match expected schema                                                                             | 6959     |
| Mar 13, 1:04 AM  | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost...    | 6959     |
| Mar 13, 12:04 AM | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost...    | 6912     |
| Mar 13, 12:03 AM | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost...    | 6912     |
| Mar 13, 12:03 AM | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost...    | 6912     |
| Mar 13, 12:01 AM | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost...    | 6914     |
| Mar 12, 4:47 PM  | `create-flow`        | Code validation failed: line 57: TS2322: Type '{ status: "open" \| "void" \| "draft" \| "paid" \| "uncollectible" \| null;... | 6495     |
| Mar 12, 3:06 PM  | `list-channels`      | Slack credential is not configured. Add a SLACK_CRED in capability settings.                                                  | 6414     |
| Mar 12, 3:06 PM  | `get-user`           | Slack credential is not configured. Add a SLACK_CRED in capability settings.                                                  | 6414     |
| Mar 12, 3:00 PM  | `list-channels`      | Slack credential is not configured. Add a SLACK_CRED in capability settings.                                                  | 6396     |
| Mar 12, 3:00 PM  | `get-user`           | Slack credential is not configured. Add a SLACK_CRED in capability settings.                                                  | 6396     |
| Mar 12, 2:16 PM  | `run-flow`           | undefined is not an object (evaluating 'slack_event.event')                                                                   | 6371     |
| Mar 12, 2:15 PM  | `run-flow`           | This action requires human approval. An approval request has been sent. Please wait for the user to approve or deny t...      | 6369     |
| Mar 12, 2:14 PM  | `get-flow`           | Flow not found or access denied                                                                                               | 6369     |
| Mar 12, 2:14 PM  | `edit-flow-code`     | Cannot modify the pearl's own flow — it is immutable during execution.                                                        | 6369     |
| Mar 12, 2:10 PM  | `edit-flow`          | Cannot modify the pearl's own flow — it is immutable during execution.                                                        | 6366     |
| Mar 12, 2:09 PM  | `get-flow`           | Flow not found or access denied                                                                                               | 6366     |
| Mar 12, 2:09 PM  | `edit-flow-code`     | Cannot modify the pearl's own flow — it is immutable during execution.                                                        | 6366     |
| Mar 12, 2:07 PM  | `run-flow`           | undefined is not an object (evaluating 'slack_event.event')                                                                   | 6364     |
| Mar 12, 2:06 PM  | `run-flow`           | This action requires human approval. An approval request has been sent. Please wait for the user to approve or deny t...      | 6359     |
| Mar 12, 1:35 PM  | `run-flow`           | This action requires human approval. An approval request has been sent. Please wait for the user to approve or deny t...      | 6323     |
| Mar 12, 1:31 PM  | `run-flow`           | This action requires human approval. An approval request has been sent. Please wait for the user to approve or deny t...      | 6311     |
| Mar 12, 1:17 PM  | `search-records`     | Received tool input did not match expected schema                                                                             | 6287     |
| Mar 12, 11:39 AM | `run-flow`           | This action requires human approval. An approval request has been sent. Please wait for the user to approve or deny t...      | 6206     |
| Mar 12, 11:38 AM | `create-flow`        | Code validation failed: line 111: Method invocation 'this.resolveUser()' inside ternary operator cannot be instrument...      | 6206     |
| Mar 12, 11:37 AM | `create-flow`        | Code validation failed: line 59: Method invocation 'this.fetchPage()' inside ternary operator cannot be instrumented....      | 6206     |
| Mar 12, 11:37 AM | `create-flow`        | Code validation failed: line 84: TS2493: Tuple type '[]' of length '0' has no element at index '0'.\n\nHint: BubbleFlow...    | 6206     |
| Mar 12, 8:34 AM  | `run-flow`           | This action requires human approval. An approval request has been sent. Please wait for the user to approve or deny t...      | 6067     |
| Mar 12, 8:33 AM  | `create-flow`        | Invalid event type: undefined                                                                                                 | 6067     |
| Mar 12, 7:47 AM  | `search-emails`      | Gmail credential is not configured. Add a GMAIL_CRED in capability settings.                                                  | 6019     |
| Mar 12, 7:47 AM  | `search-emails`      | Gmail credential is not configured. Add a GMAIL_CRED in capability settings.                                                  | 6019     |
| Mar 12, 7:26 AM  | `linkedin`           | Input Schema validation failed: workplaceType.2: Invalid enum value. Expected 'on-site' \| 'remote' \| 'hybrid', receiv...    | 5993     |
| Mar 12, 7:15 AM  | `create-flow`        | Code validation failed: line 103: Method invocation 'this.formatAmount()' inside object property cannot be instrument...      | 5981     |
| Mar 12, 7:10 AM  | `linkedin`           | Input Schema validation failed: sortBy: Invalid enum value. Expected 'relevance' \| 'date_posted', received 'recent'          | 5977     |
| Mar 12, 6:52 AM  | `run-flow`           | This action requires human approval. An approval request has been sent. Please wait for the user to approve or deny t...      | 5949     |
| Mar 12, 6:51 AM  | `get-trigger-detail` | Invalid trigger type 'cron/schedule'. Valid types are: slack/message_received, slack/bot_mentioned, slack/reaction_ad...      | 5949     |
| Mar 12, 2:02 AM  | `web-scrape-tool`    | Received tool input did not match expected schema                                                                             | 5628     |
| Mar 12, 2:02 AM  | `web-scrape-tool`    | Received tool input did not match expected schema                                                                             | 5628     |
| Mar 12, 12:07 AM | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost...    | 5505     |
| Mar 12, 12:06 AM | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost...    | 5505     |
| Mar 11, 11:46 PM | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost...    | 5486     |
