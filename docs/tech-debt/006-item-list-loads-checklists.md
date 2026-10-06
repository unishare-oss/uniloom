# TD-006: The item list loads every checklist

Status: Open
Found: 2026-10-06, in plan 11

## Problem

`itemView` in `items/item.repository.ts` includes `checklist`, and `listItems` and
`listDeletedItems` use it, so the board query loads every entry of every item although a
list row (`toListRow`) never shows them.

## Why it was left

One shared view keeps `toItem` and `toListRow` on the same row type. Checklists are small
(Guided defaults to 3-6 entries) and the board has no done/total count yet.

## Fix

Give the list queries their own view without `checklist`, or add a count when the board
card needs "3/6" (a later web slice).
