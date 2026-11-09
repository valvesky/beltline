# lru

A cache backed by a doubly linked list and a binary heap of timestamps. `set` pushes to the heap and evicts the minimum timestamp when full.
