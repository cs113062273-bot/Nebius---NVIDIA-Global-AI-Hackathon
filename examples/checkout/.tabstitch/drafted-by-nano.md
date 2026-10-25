### ↹ Tabstitch · drafted tasks

> Open the order dialog with the keyboard, type a delivery note, place the order and see the confirmation

- Attempt 1 · Nemotron 3 Nano · 14,471 tokens: rejected ([
  {
    "code": "custom",
    "message": "Keyboard journeys cannot dispatch pointer actions",
    "path": [
      "journey"
    ]
  }
])
- Attempt 2 · Nemotron 3 Nano · 15,855 tokens: keyboard passes, pointer passes, guard-1 passes

Saved to `drafted-by-nano.json`: every journey passes on this build. Read it, then change every `"source": "model"` to `"authored"` to accept it as the frozen oracle; check and repair refuse model-sourced tasks.
