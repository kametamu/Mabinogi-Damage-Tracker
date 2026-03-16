# Mabinogi Packet Parser Research Memo / マビノギ パケットパーサー調査メモ

> **English**  
> This document is a research memo for parser development and packet structure analysis.  
> It contains both confirmed findings and working hypotheses, and may be updated as understanding improves.  
> The original packet-structure notes and comment-based hints inside the parser were left by OSS contributors and prior developers. This document reorganizes and clarifies those notes with respect and appreciation, so they are easier to understand, preserve, and extend.
>
> **日本語**  
> このドキュメントは、パーサー開発とパケット構造解析のための調査メモです。  
> 確定事項だけでなく作業仮説も含んでおり、理解の進展に応じて更新されます。  
> また、最初に存在していたパケット構造メモやコード中のコメントアウトによるヒントは、OSS を公開してくれている方々や先行開発者が残してくれたものです。本資料は、それらの知見へのリスペクトを前提に、内容をより分かりやすく整理・再構成したものです。

**Last updated / 最終更新:** 2026-03

---

## Table of Contents / 目次

- [1. Purpose / 目的](#1-purpose--目的)
- [2. High-level Summary / 全体概要](#2-high-level-summary--全体概要)
- [3. Overall Packet Structure / 全体パケット構造](#3-overall-packet-structure--全体パケット構造)
- [4. Confirmed and Suspected Opcode Roles / opcode の役割（確定・推定）](#4-confirmed-and-suspected-opcode-roles--opcode-の役割確定推定)
  - [4.1 `0x7926` = CombatActionPack](#41-0x7926--combatactionpack)
  - [4.2 `0x520C` = EntityAppears](#42-0x520c--entityappears)
  - [4.3 `0x5334` = EntitiesAppear](#43-0x5334--entitiesappear)
- [5. Current Understanding of `0x7926` Structure / `0x7926` の現時点での構造理解](#5-current-understanding-of-0x7926-structure--0x7926-の現時点での構造理解)
- [6. Wooden Dummy Test Flow / 木人テストの流れ](#6-wooden-dummy-test-flow--木人テストの流れ)
- [7. Most Important Findings from Spawn-vs-Damage Comparison / スポーンとダメージの突合で得られた重要結果](#7-most-important-findings-from-spawn-vs-damage-comparison--スポーンとダメージの突合で得られた重要結果)
- [8. Current Working Model / 現在の作業仮説](#8-current-working-model--現在の作業仮説)
- [9. What Is Confirmed / 確定していること](#9-what-is-confirmed--確定していること)
- [10. What Is Not Solved Yet / 未解決のこと](#10-what-is-not-solved-yet--未解決のこと)
- [11. What Has Already Been Disproved or Weakened / すでに弱くなった・否定寄りの仮説](#11-what-has-already-been-disproved-or-weakened--すでに弱くなった否定寄りの仮説)
- [12. Logging and Debug Outputs / ログとデバッグ出力](#12-logging-and-debug-outputs--ログとデバッグ出力)
- [13. Recommended Next Steps / 今後の推奨方針](#13-recommended-next-steps--今後の推奨方針)
- [14. Recommended Implementation Direction / 実装方針のおすすめ](#14-recommended-implementation-direction--実装方針のおすすめ)
- [15. Important Reminder for Future Work / 今後のための重要な注意](#15-important-reminder-for-future-work--今後のための重要な注意)
- [16. Short Version / 短い要約](#16-short-version--短い要約)

---

## 1. Purpose / 目的

### English
This memo is intended to preserve the current understanding of the packet parser and reverse-engineering progress, so future work can resume without repeating the same investigations. It records what is confirmed, what is only suspected, what has already been disproved, and what should be investigated next.

### 日本語
このメモは、現在のパケットパーサーとリバースエンジニアリングの進捗を保存し、次回以降に同じ調査を繰り返さず再開できるようにするためのものです。確定していること、推測段階のこと、すでに否定された仮説、今後調べるべきことを整理して記録します。

---

## 2. High-level Summary / 全体概要

### English
Current high-confidence understanding:

- `0x7926` is the combat/damage packet and is currently the most reliable source of `enemy_id`.
- `0x520C` is a spawn-related packet and seems to contain fixed/template-like entity information.
- The `enemy_id` observed in damage packets appears to be a runtime instance ID that changes every run/spawn.
- The stable IDs seen in spawn packets do **not** currently match the runtime `enemy_id` seen in combat.
- Therefore, the missing piece is likely the mapping:

`runtime enemy_id -> fixed/template id -> display name`

This means the problem is not that enemies are impossible to identify. The real problem is that the runtime ID used during combat has not yet been linked to the stable/fixed ID used for name resolution.

### 日本語
現時点で信頼度高めの理解は以下です。

- `0x7926` は戦闘・ダメージ系パケットであり、現在 `enemy_id` を取る最も信頼できる情報源です。
- `0x520C` はスポーン関連パケットで、固定IDやテンプレートIDのような情報を持っている可能性が高いです。
- ダメージパケットに出てくる `enemy_id` は、その都度生成される実体ID（ランタイムID）に見えます。
- スポーンパケット側で見えている安定したIDは、戦闘中に見える `enemy_id` とは一致していません。
- そのため、いま足りていないのは次の対応関係だと考えられます。

`runtime enemy_id -> fixed/template id -> display name`

つまり問題は「敵を識別できない」ことではなく、「戦闘中の実体IDと、名前解決に使えそうな固定IDがまだつながっていない」ことです。

---

## 3. Overall Packet Structure / 全体パケット構造

### English
Each TCP payload may contain multiple sub packets.

Current working understanding of a sub packet:

- `byte[0]` : sign / marker (purpose unknown)
- `byte[1-4]` : sub packet length (`UInt32`, Little Endian)
- `byte[5]` : header flag
- `byte[6-9]` : opcode (`UInt32`, Big Endian)
- `byte[10-17]` : packet id? (`UInt64`, Big Endian)
- `byte[18..]` : variable-length integer (custom unsigned varint-like format)
- then body payload follows

The payload body appears to use typed fields:

- `1 = byte`
- `2 = short`
- `3 = int32`
- `4 = long / uint64`
- `5 = float`
- `6 = string`
- `7 = bin`

This is still a working model, but it has been useful for interpreting `0x520C` and `0x7926`.

### 日本語
1つの TCP ペイロードの中には、複数のサブパケットが入っているようです。

現時点でのサブパケット構造の理解：

- `byte[0]` : sign / marker（役割は未確定）
- `byte[1-4]` : サブパケット長（`UInt32`, Little Endian）
- `byte[5]` : ヘッダフラグ
- `byte[6-9]` : opcode（`UInt32`, Big Endian）
- `byte[10-17]` : packet id らしき値（`UInt64`, Big Endian）
- `byte[18..]` : 可変長整数（独自形式の unsigned varint 風）
- その後に本文データが続く

本文側は typed field 形式になっているように見えています。

- `1 = byte`
- `2 = short`
- `3 = int32`
- `4 = long / uint64`
- `5 = float`
- `6 = string`
- `7 = bin`

まだ仮説込みのモデルではありますが、`0x520C` や `0x7926` を読むうえでかなり役立っています。

---

## 4. Confirmed and Suspected Opcode Roles / opcode の役割（確定・推定）

### 4.1 `0x7926` = CombatActionPack

#### English
This is the most reliable combat packet currently identified.

The parser already extracts:

- `attacker_id`
- `enemy_id`
- `skillid`
- `subskillid`
- `damage`
- `wound`
- `manaDamage`

At the moment, this is the best source of the actual combat target ID.

#### 日本語
現時点で最も信頼できる戦闘パケットです。

パーサーではすでに以下を抽出できています。

- `attacker_id`
- `enemy_id`
- `skillid`
- `subskillid`
- `damage`
- `wound`
- `manaDamage`

いまのところ、実際に殴った相手の ID を取る最良の情報源はこれです。

### 4.2 `0x520C` = EntityAppears

#### English
This strongly appears to be a spawn-related packet.

It is observed around room entry / enemy appearance timing. It contains stable-looking IDs and typed-field-like content.

However, current evidence suggests:

- It does **not** directly contain the same `enemy_id` used in `0x7926` damage packets.
- It likely contains fixed/template/class/object-definition-like information instead.

#### 日本語
強くスポーン関連パケットだと思われます。

部屋への入場や敵出現タイミングで観測されており、安定した ID や typed field っぽい構造を含んでいます。

ただし現時点の証拠からは次のように見えています。

- `0x7926` のダメージパケットに出る `enemy_id` と同じ値は、直接は入っていない
- 代わりに、固定ID・テンプレートID・クラスID・オブジェクト定義IDのような情報を持っている可能性が高い

### 4.3 `0x5334` = EntitiesAppear

#### English
By name, this looks like a multi-entity spawn packet.

However, in the wooden dummy test scenario, no reliable evidence has been captured yet. It may exist in other content or conditions, but it is not currently the main source in this specific test flow.

#### 日本語
名前からすると複数体スポーン用のパケットに見えます。

ただし、木人部屋での検証では信頼できる形ではまだ捕まえられていません。別コンテンツや別条件では使われている可能性はありますが、現状のこのテストでは主役ではなさそうです。

---

## 5. Current Understanding of `0x7926` Structure / `0x7926` の現時点での構造理解

### English
Inside `0x7926`, there are sub-sub packets.

The sub packet header appears to contain:

- `actionpack_id`
- `prev_actionpack_id`
- `hit`
- `ttype`
- `unk1`
- `sub_header_flag`
- `subsub_packet_count`

If `sub_header_flag` indicates a blocked / extra section, extra fields follow. These are currently skipped.

Each sub-sub packet appears to contain:

- `combatActionID`
- `entityID`
- `subsub_ttype`
- `stun`
- `skillid`
- `subskillid`
- `unk1`

Current working interpretation of `subsub_ttype`:

- `(subsub_ttype & 2) != 0` : attacker-side block
- `(subsub_ttype & 1) != 0` : damage/result-side block

When attacker-side block is present:
- `entityID` is treated as `attacker_id`

When damage/result-side block is present:
- `entityID` is treated as `enemy_id`
- followed by:
  - `options`
  - `damage`
  - `wound`
  - `manaDamage`

This logic is currently the most trustworthy part of the parser.

### 日本語
`0x7926` の中にはサブサブパケットが存在します。

サブパケットヘッダには、おおむね次のような情報があると見ています。

- `actionpack_id`
- `prev_actionpack_id`
- `hit`
- `ttype`
- `unk1`
- `sub_header_flag`
- `subsub_packet_count`

`sub_header_flag` に blocked / extra section を示すビットが立っている場合、追加データが続きます。現在はそこはスキップしています。

各サブサブパケットには、次のような情報があるようです。

- `combatActionID`
- `entityID`
- `subsub_ttype`
- `stun`
- `skillid`
- `subskillid`
- `unk1`

`subsub_ttype` の現時点での解釈：

- `(subsub_ttype & 2) != 0` : 攻撃者側ブロック
- `(subsub_ttype & 1) != 0` : ダメージ結果側ブロック

攻撃者側ブロックがあるとき：
- `entityID` を `attacker_id` とみなしている

ダメージ結果側ブロックがあるとき：
- `entityID` を `enemy_id` とみなしている
- その後に以下が続く
  - `options`
  - `damage`
  - `wound`
  - `manaDamage`

このロジックは現状のパーサーの中で最も信頼できる部分です。

---

## 6. Wooden Dummy Test Flow / 木人テストの流れ

### English
The main repeatable test flow has been:

1. Start capture before entering
2. Enter the wooden dummy mission room
3. Wait a few seconds
4. Attack once or twice
5. Leave immediately
6. Repeat multiple times

This was useful because:
- the room is controlled
- the number of targets is stable
- the moment of spawn is easy to isolate
- the first damage event is easy to correlate with nearby spawn packets

### 日本語
主に繰り返してきたテストの流れは次の通りです。

1. 入場前からキャプチャ開始
2. 木人ミッション部屋に入る
3. 数秒待機
4. 1〜2回だけ攻撃する
5. すぐ退場
6. これを複数回繰り返す

この手順が役立った理由は次の通りです。

- 部屋の条件が一定
- 対象数が安定している
- 出現タイミングを切り分けやすい
- 最初のダメージイベントとスポーン周辺の通信を対応させやすい

---

## 7. Most Important Findings from Spawn-vs-Damage Comparison / スポーンとダメージの突合で得られた重要結果

### English
This is the most important result so far.

Observed in `0x7926`:
- `enemy_id` changes every run
- typical pattern: `0x0010F000001E....`

Observed in `0x520C`:
- stable repeated values such as:
  - `0x0010F00000001C05`
  - `0x0010F00000001C06`
- nearby decimal string values such as:
  - `"4767482418044270"`
  - `"4767482418044271"`

These spawn-side values did **not** match the runtime `enemy_id` seen in damage packets.

Interpretation:
- `0x520C` likely contains a stable/fixed/template-side identifier
- `0x7926` contains a per-instance combat target ID
- these are different layers of identity

### 日本語
ここが今回の検証で最も重要な結果です。

`0x7926` 側で観測されたこと：
- `enemy_id` は毎回変わる
- 典型的には `0x0010F000001E....` のような形

`0x520C` 側で観測されたこと：
- 次のような安定した値が繰り返し出る
  - `0x0010F00000001C05`
  - `0x0010F00000001C06`
- その近くに、次のような10進文字列が出る
  - `"4767482418044270"`
  - `"4767482418044271"`

これらのスポーン側の値は、ダメージ側の実体 `enemy_id` と一致しませんでした。

解釈：
- `0x520C` は安定した fixed/template 側の識別子を持っている
- `0x7926` はその都度生成される戦闘対象の実体IDを持っている
- つまり、別レイヤーの ID を見ている可能性が高い

---

## 8. Current Working Model / 現在の作業仮説

### English
The current best model is:

1. Spawn packet (`0x520C`) provides fixed/template-side entity information
2. Another packet may provide or imply the runtime instance entity ID
3. Damage packet (`0x7926`) uses the runtime enemy ID
4. A readable display name may be resolved through the fixed/template side

Practical mapping target:

`runtime enemy_id -> fixed/template id -> display name`

### 日本語
現時点で最もしっくりくるモデルは次の通りです。

1. スポーンパケット (`0x520C`) が fixed/template 側のエンティティ情報を持つ
2. 別のパケットが実体ランタイムIDを持つ、またはそこから推定できる
3. ダメージパケット (`0x7926`) は実体 enemy_id を使う
4. 表示名は fixed/template 側から解決される可能性が高い

最終的に狙う対応関係は：

`runtime enemy_id -> fixed/template id -> display name`

---

## 9. What Is Confirmed / 確定していること

### English
The following points are relatively high confidence:

- `0x7926` is the best current source for `enemy_id`
- `0x520C` is spawn-related
- `0x520C` contains stable/fixed-looking identifiers
- the stable IDs in `0x520C` do not directly match the runtime `enemy_id` in `0x7926`
- therefore, spawn packet direct equality matching is not enough

### 日本語
以下は比較的確度が高いです。

- `0x7926` は `enemy_id` を取るための最良の情報源
- `0x520C` はスポーン関連である
- `0x520C` には安定した fixed/template 寄りの識別子がある
- `0x520C` の安定IDは、`0x7926` の runtime `enemy_id` とは直接一致しない
- したがって、スポーンパケットとの単純一致では足りない

---

## 10. What Is Not Solved Yet / 未解決のこと

### English
Still unknown:

- Which packet links runtime `enemy_id` to fixed/template id
- Whether the deeper part of `0x520C` contains that mapping
- Whether a skipped large packet around room entry contains the mapping
- Whether `0x5334` or another opcode is important in other scenarios
- Where the actual enemy display name is encoded

### 日本語
まだ分かっていないこと：

- runtime `enemy_id` と fixed/template id を結びつけるパケットが何か
- `0x520C` の後半にその対応が埋まっているかどうか
- 入場直後にスキップされている大きなパケットの中に対応情報があるかどうか
- `0x5334` や別 opcode が他シナリオで重要かどうか
- 実際の敵表示名がどこにエンコードされているか

---

## 11. What Has Already Been Disproved or Weakened / すでに弱くなった・否定寄りの仮説

### English
The following assumptions are currently weak or disproved:

- “`0x520C` directly contains the same `enemy_id` as combat packets”
- “wooden dummy room definitely uses `0x5334` in a useful way for this test”
- “the repeated decimal string in `0x520C` is the damage `enemy_id` itself”

These assumptions should not be the default starting point anymore unless new evidence appears.

### 日本語
以下の仮説は、現時点では弱いか、ほぼ否定寄りです。

- 「`0x520C` に戦闘パケットと同じ `enemy_id` が直接入っている」
- 「木人部屋では `0x5334` が今回の解析に有効な形で必ず使われている」
- 「`0x520C` にある繰り返しの10進文字列そのものが damage `enemy_id` である」

新しい証拠が出ない限り、これらを前提に再スタートしない方がよいです。

---

## 12. Logging and Debug Outputs / ログとデバッグ出力

### English
Useful files currently used:

- `damage_trace.txt`
  - attacker_id / enemy_id / skillid / damage
- `entity_trace.txt`
  - experimental correlation notes
- `spawn_520C_dump.txt`
  - full hex / offset hex / typed field walk / likely ids
- `spawn_5334_dump.txt`
  - used only if `0x5334` is actually captured
- skip logs such as `skip_trace.txt`
  - skipped packets with flag / len / opcode / short header bytes

These are useful for side-by-side correlation.

### 日本語
現在使っている有用なファイル：

- `damage_trace.txt`
  - attacker_id / enemy_id / skillid / damage
- `entity_trace.txt`
  - 実験的な対応関係メモ
- `spawn_520C_dump.txt`
  - full hex / offset hex / typed field walk / likely ids
- `spawn_5334_dump.txt`
  - `0x5334` が実際に取れたとき用
- `skip_trace.txt` などの skip ログ
  - flag / len / opcode / 先頭バイト列つきのスキップ情報

これらを並べて突き合わせるのが有効です。

---

## 13. Recommended Next Steps / 今後の推奨方針

### English
Most useful next actions:

1. Keep extracting `enemy_id` from `0x7926`
2. Keep collecting stable/fixed-like identifiers from `0x520C`
3. Dump large skipped packets around room entry to text files
4. Search for packets that contain both:
   - runtime-like IDs (`0x0010F000001E....`)
   - fixed/template-like IDs (`0x0010F00000001C..`)
5. Once fixed/template IDs are stable, use them as the basis for display name lookup

If direct mapping remains difficult:
- heuristic mapping by timing, spawn order, or position may become a fallback
- but a direct packet mapping remains preferable

### 日本語
次にやる価値が高いこと：

1. `0x7926` から `enemy_id` を引き続き取る
2. `0x520C` から stable/fixed 寄りIDを引き続き集める
3. 入場直後にスキップされている大きなパケットを txt に吐く
4. 次の両方を同時に含むパケットを探す
   - runtime っぽいID (`0x0010F000001E....`)
   - fixed/template っぽいID (`0x0010F00000001C..`)
5. fixed/template 側のIDが安定してきたら、それを表示名解決のキーに使う

もし直接対応が見つからない場合は、
- タイミング
- 出現順
- 位置情報

などによるヒューリスティックな対応付けも選択肢になります。  
ただし、できるなら直接対応パケットを見つける方が望ましいです。

---

## 14. Recommended Implementation Direction / 実装方針のおすすめ

### English
A practical long-term implementation strategy would be:

- use runtime `enemy_id` for combat event grouping
- use fixed/template-like IDs for name lookup
- build a two-stage resolution model:

`runtime enemy_id -> fixed/template id -> display name`

This is cleaner than assuming a single ID is used everywhere.

### 日本語
現実的な長期実装方針としては次がよさそうです。

- runtime `enemy_id` は戦闘イベントのグルーピングに使う
- fixed/template 寄りIDは名前解決に使う
- 2段階の名前解決モデルを作る

`runtime enemy_id -> fixed/template id -> display name`

「どこでも同じ1つのIDが使われている」と考えるより、こちらの方が自然です。

---

## 15. Important Reminder for Future Work / 今後のための重要な注意

### English
Do not restart from the assumption that spawn packet equality alone will solve enemy naming. The investigation has already shown that direct equality is likely insufficient.

The new focus should be:
- mapping layers of identity
- not just finding “the enemy ID”

### 日本語
次回以降、「スポーンパケットと一致させれば敵名が取れるはず」という前提から再開しないこと。今回の調査で、単純一致だけでは足りない可能性が高いと分かっています。

今後の焦点は、
- 「敵IDを1個見つけること」ではなく
- 「複数レイヤーのIDをどう結びつけるか」

に移っています。

---

## 16. Short Version / 短い要約

### English
- `0x7926` gives the real combat-time runtime `enemy_id`
- `0x520C` gives stable/fixed/template-like spawn-side identifiers
- these are probably different identity layers
- the missing task is linking them
- enemy naming is still possible, but now looks like a multi-step mapping problem

### 日本語
- `0x7926` は戦闘時の実体 `enemy_id` を出す
- `0x520C` は安定した fixed/template 寄りの識別子を出す
- この2つは別レイヤーのIDっぽい
- 足りないのは両者の対応付け
- 敵名表示はまだ狙えるが、1段ではなく多段対応の問題になっている
