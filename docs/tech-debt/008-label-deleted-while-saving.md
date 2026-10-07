# TD-008: A label deleted while an item's labels are saved returns 500

Status: Open
Found: 2026-10-07, in plan 27

## Problem

`PATCH /items/:id` with `labelIds` checks the labels exist, then replaces the item's
`ItemLabel` rows in a transaction. If an owner deletes one of those labels in between,
the insert hits a foreign-key error and the API answers 500 instead of 400
`invalid_labels`.

## Why it was left

It needs an owner deleting a label in the same instant a member saves that label on an
item. Nothing is stored wrongly: the transaction rolls back.

## Fix

Catch the foreign-key error (`P2003`) in the repository, return null, and answer 400
`invalid_labels` from the service, the same way `createProject` handles `P2002`.
