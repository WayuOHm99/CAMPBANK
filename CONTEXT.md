# EQCAMP

EQCAMP manages simulated activity scoring for camp groups. It replaces physical play money and paper tallying without representing real money or payments.

## Core language

**Camp (ค่าย)**:
A single camp event whose groups, people, activities, score budget, transactions, and leaderboard are isolated from every other Camp.
_Avoid_: Event, project

**Group (กลุ่ม)**:
A competing team within one Camp, identified by a unique preset color and an optional participant-chosen Group Name.
_Avoid_: Color, team color

**Group Name (ชื่อกลุ่ม)**:
An optional participant-chosen name for a Group. Until one is set, the interface identifies the Group as `กลุ่มสี<ชื่อสี>`.
_Avoid_: Color name, team name

**Score (คะแนน)**:
A non-negative whole-number result held by a Group; one unit of simulated activity money equals one Score point. Use “คะแนน” as the canonical interface term.
_Avoid_: Money, balance, cash, baht

**Camp Budget (งบค่าย)**:
The maximum total Score that a Camp may have distributed across all Groups at a given time. It is simulated capacity, not real money.
_Avoid_: Cash budget, account balance

**Distributed Score (คะแนนที่แจกแล้ว)**:
The total Score currently held by all Groups in one Camp.
_Avoid_: Money spent, cash distributed

**Remaining Budget (งบคงเหลือ)**:
The portion of the Camp Budget not currently distributed as Group Score.
_Avoid_: Cash remaining

**Budget Warning (คำเตือนงบค่าย)**:
A non-blocking warning that Remaining Budget has reached either an Admin-defined amount or percentage threshold.
_Avoid_: Budget limit, payment warning

**Score Transaction (รายการคะแนน)**:
An immutable record of one Score change, including its actor and optional Activity context. Corrections are new Score Transactions rather than edits or deletions.
_Avoid_: Score edit, balance edit

**Score Button (ปุ่มคะแนน)**:
An Admin-configured ordinary Score action with a fixed, non-zero whole-number amount and a label derived from that amount. It is one-tap by default; an Admin may require an interaction confirmation for an exceptional button without changing database authorization or Score validation.
_Avoid_: Money Button, cash button

**Integrity Failure (ความผิดปกติของคะแนน)**:
A Camp state in which distributed Score no longer equals the sum of its Group Scores. Scoring stops until the underlying Transaction history is investigated; the mismatch is never repaired silently.
_Avoid_: Display glitch, rounding error

## People

**Staff**:
A Camp-scoped participant who may select their own name and perform ordinary Score actions without a PIN.
_Avoid_: Student, cashier

**Admin**:
A system-wide operator with one identity and PIN, plus explicit memberships in one or more Camps.
_Avoid_: Camp-specific duplicate admin

**Admin Account**:
The single system-wide identity and PIN belonging to an Admin, independent of that Admin’s Camp memberships.
_Avoid_: Admin membership, duplicated camp admin

**Camp Membership**:
The relationship granting an Admin or Staff member a role within one specific Camp. Membership never grants access to another Camp.
_Avoid_: Admin account, global camp access

## Activity context

**Activity (กิจกรรม)**:
Optional context explaining where a Score Transaction occurred.
_Avoid_: Category

**Activity Round (รอบกิจกรรม)**:
An optional subdivision of an Activity. When present on a Score Transaction, it belongs to the selected Activity.
_Avoid_: Session

## Corrections and results

**Quick Undo (ย้อนกลับ)**:
An immediate Staff correction of that Staff member’s latest Score Transaction, recorded as a new opposite Score Transaction.
_Avoid_: Delete, rollback history

**Admin Adjustment (การปรับคะแนนโดย Admin)**:
An Admin-authored corrective Score Transaction with a required reason, including corrections made after a Camp is closed.
_Avoid_: Edit transaction

**Leaderboard (อันดับ)**:
The ordered view of Groups by current Score, with the time each Group reached that Score resolving ties.
_Avoid_: Report

**Leaderboard Visibility**:
The Admin-controlled state that decides whether Staff and public viewers may see the ordered Leaderboard; Admins may always see it.
_Avoid_: Group Score visibility

**Public Result Range (ช่วงอันดับผลค่าย)**:
The Admin-selected top 3, top 5, or top 10 positions shown on the Public Leaderboard and public Camp result; it never removes or hides results from Admin records.
_Avoid_: Winner count, deleted ranks

**Closed Camp (ค่ายที่ปิดแล้ว)**:
A Camp that accepts no ordinary Score actions; only an explicit audited Admin Adjustment may change its result.
_Avoid_: Paused camp

**Draft Camp (ค่ายฉบับร่าง)**:
A Camp still being configured and not yet available for ordinary Staff Score actions.
_Avoid_: Inactive camp

**Active Camp (ค่ายที่เปิดใช้งาน)**:
A fully configured Camp that currently accepts ordinary Staff Score actions.
_Avoid_: Draft camp, open session

## Access surfaces

**Staff Join Link**:
A private Camp link containing its own randomly generated, hard-to-guess Staff Join Code; it lets Staff select their identity and enter the scoring interface.
_Avoid_: Public camp link

**Public Leaderboard Link**:
A separate read-only Camp link with its own randomly generated code whose content is controlled by Leaderboard visibility.
_Avoid_: Staff join link
