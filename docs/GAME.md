# The Green Reach

Embervale's first outdoor zone is **1,000 × 1,000 metres**, with coordinates
from −500 to +500 on both horizontal axes. North is positive Z. The landscape
is an original, stylized human borderland: timber cottages, cultivated fields,
lantern roads, a shallow brook with timber fords, quarry terraces, an abbey, and
a northern watchtower. All geometry is generated locally; no art downloads are
required.

## Exploring

Begin in Embervale and speak to **Warden Elin**, beside the lantern path. Walk
within six metres and press **E**, or click the NPC. Read the conversation and
choose **Accept quest**. Completed objectives must be turned in to the original
quest giver. Quest progress belongs to your current guest character.

Press **M** for the full map. Gold dots mark quest givers, the outlined ring is
your tracked objective, white is your character, and blue marks companions.
The minimap also shows nearby enemies and resources for active gathering quests.
Click a quest in the tracker to change its map objective. Distances are in metres.

Press **C** for a close character view; press it again to restore your camera.
Right-drag to orbit and scroll to zoom. The default adventurer has an animated
anime model; see [the character guide](CHARACTER.md) for its design and art source.

Press **R** to summon or dismiss your travel horse. Riding moves at 18 m/s;
walking moves at 6 m/s. Casting or taking damage dismounts you. You cannot mount
until six seconds after your last attack or incoming hit. **Windstep** is useful
for a short escape, but respects building collision and the zone boundary.

## People and quests

| Settlement | Quest giver | Adventures |
| --- | --- | --- |
| Embervale (0, 0) | Warden Elin | Defeat 3 wisps; then visit Westmere and report back |
| Westmere Fields (−155, 100) | Farmer Mara | Collect 3 grain sacks; then defeat 4 boars |
| Willowbrook (160, 155) | Captain Tomas | Defeat 4 brigands; then visit Northwatch and return |
| Redstone Quarry (265, −155) | Mason Bryn | Collect 3 mason's stones |
| Ashen Abbey (−245, −255) | Sister Ada | Defeat 4 revenants; then defeat a hollow guardian |
| Northwatch (10, 390) | Scout Orren | Defeat 4 timber wolves |

Each gathering quest requires three **different** nodes, collected within five
metres using E or a click. Resources are personal: one player cannot take another
player's supply. Exploration objectives complete within 24 metres of their
settlement. Objectives only count after acceptance. Completed quests cannot pay
out twice. Follow-up quests become available after the previous quest's turn-in.
There are ten quests total, with rewards from 60 to 250 XP.

## Warden spells

Every character starts with six spells and 100 mana. Mana regenerates at 8 per
second. Successful spells share a 0.65-second recovery, in addition to their own
cooldowns. Invalid casts spend neither mana nor cooldown.

| Key | Spell | Effect | Mana | Cooldown |
| --- | --- | --- | --- | --- |
| 1 | Sunbolt | 25 damage, 24 m range | 0 | 0.8 s |
| 2 | Mending light | Restore 45 health, up to 100 | 25 | 6 s |
| 3 | Frost lance | 32 damage, 28 m range; slow movement by 65% for 5 s | 15 | 3.5 s |
| 4 | Fireburst | 45 damage to enemies within 6 m of the target; 22 m cast range | 30 | 6 s |
| 5 | Stone ward | Halve incoming damage for 8 s, rounded up | 20 | 15 s |
| 6 | Windstep | Dash 12 m in your facing direction | 15 | 8 s |

Select a living enemy with Tab or by clicking its model. Sunbolt, Frost lance,
and Fireburst require a target; the other spells affect yourself. The server
checks range, cooldowns, resources, damage, movement and all rewards.

## Enemies and progression

The zone contains 74 enemies of six types: restless wisps, bristleback boars,
timber wolves, roadside brigands, abbey revenants, and hollow guardians. Their
health ranges from 75 to 320. Enemies pursue nearby players or retaliate against
ranged attacks. They return home when their target leaves their 32 m home area,
recover at home, and respawn 15 seconds after defeat.

Kill credit and kill-quest progress go to the player who lands the final blow.
There is no party sharing yet. XP also comes from quest turn-ins. Each 250 XP
increases the displayed renown rank; it does not increase combat stats yet.
Defeat returns a player to Embervale with full health and mana, preserving their
session's quest progress.

## Prototype limits

Characters, quests and XP reset on leaving the session or restarting the server.
Accounts, persistence, inventory, loot, class selection and PvP are not present.
The zone supports a configured maximum of 20 clients per room; this is not a
load-test result. All entities currently replicate within their room. Nearby
terrain/decorations and enemies are culled on the client; server interest
management is a later step.

The world uses a shared height surface. Buildings and the main towers block
movement; most decorative trees, rocks, fences and ruined columns do not.
The shallow brook is traversable, and there is no swimming or jumping yet.
Enemy navigation uses direct pursuit and simple obstacle collision, so complex
pathfinding around structures remains future work. This is a local multiplayer
prototype, not a production-hosted MMO.
