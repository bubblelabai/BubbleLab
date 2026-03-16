### Error Log

| Time (PDT)       | Tool                 | Error Summary                                                                                                              | Trace ID |
| :--------------- | :------------------- | :------------------------------------------------------------------------------------------------------------------------- | :------: |
| Mar 15, 10:08 PM | `create-flow`        | Code validation failed: line 47: TS2352: Conversion of type 'Record<string, unknown>[]' to type 'ToolErrorRow[]' may ...   |  10627   |
| Mar 15, 10:07 PM | `query-trace`        | Step 4 not found in steps view                                                                                             |  10627   |
| Mar 15, 6:11 PM  | `get-trigger-detail` | Invalid trigger type 'zendesk/ticket_created'. Valid types are: slack/message_received, slack/bot_mentioned, slack/re...   |  10363   |
| Mar 15, 7:48 AM  | `run-flow`           | This action requires human approval. An approval request has been sent. Please wait for the user to approve or deny t...   |   9733   |
| Mar 15, 7:48 AM  | `create-flow`        | Code validation failed: line 79: TS2352: Conversion of type '{ id: string \| null; photo: string \| null; verified: boo... |   9733   |
| Mar 15, 7:47 AM  | `get-trigger-detail` | Invalid trigger type 'cron'. Valid types are: slack/message_received, slack/bot_mentioned, slack/reaction_added, slac...   |   9733   |
| Mar 15, 7:41 AM  | `create-flow`        | Code validation failed: line 35: TS2352: Conversion of type 'Record<string, unknown>[]' to type 'UserRow[]' may be a ...   |   9723   |
| Mar 15, 6:27 AM  | `create-flow`        | Code validation failed: line 31: Method invocation 'this.formatTimestamp()' inside object property cannot be instrume...   |   9636   |
| Mar 15, 5:51 AM  | `linkedin`           | Input Schema validation failed: operation: Invalid enum value. Expected 'scrapeProfile' \| 'scrapePosts' \| 'searchPost... |   9590   |
| Mar 15, 4:50 AM  | `create-flow`        | Code validation failed: line 27: TS2345: Argument of type '(row: { email: string; first_name: string \| null; last_nam...  |   9519   |
