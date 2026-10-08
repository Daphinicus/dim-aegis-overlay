"""Generate the offline weapon identity index from Bungie's English item manifest.

No network requests are made. Regenerate alongside the canonical hash registry.
Shared intrinsic and armor enhancement families are intentionally excluded.
"""
import argparse
import json
from pathlib import Path
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("manifest", type=Path)
parser.add_argument("--version", required=True, help="Bungie manifest version")
parser.add_argument("--enhancement-links", type=Path, help="Verified DIM trait-to-enhanced-trait table")
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
definitions = json.loads(args.manifest.read_text(encoding="utf-8"))

categories = {
    "barrels": "barrel", "scopes": "barrel", "tubes": "barrel",
    "blades": "barrel", "bowstrings": "barrel", "hafts": "barrel",
    "rails": "barrel", "v950.new.sword0.blades": "barrel",
    "magazines": "mag", "magazines_gl": "mag", "batteries": "mag",
    "guards": "mag", "arrows": "mag", "bolts": "mag",
    "frames": "trait", "origins": "origin",
}
canonical_source = (root / "src/canonical-hashes.ts").read_text(encoding="utf-8")
canonical_match = re.search(r"CANONICAL_PERK_HASHES[^=]*= (\{[^\n]*\});", canonical_source)
if canonical_match is None:
    raise ValueError("Cannot find the canonical perk registry")
canonical = json.loads(canonical_match.group(1))

names = {}
for definition in definitions.values():
    category = categories.get(definition.get("plug", {}).get("plugCategoryIdentifier"))
    name = definition.get("displayProperties", {}).get("name", "")
    if not category or not name:
        continue
    key = re.sub(r"\s+", " ", name.lower().strip())
    names.setdefault(key, {}).setdefault(category, []).append(definition)

# Enhancement equivalence comes from DIM's verified hash links, never display-name stripping.
links = json.loads((args.enhancement_links or root / "data/trait-to-enhanced-trait.json").read_text(encoding="utf-8"))
enhanced_to_normal = {}
for normal_hash, enhanced_hash in links.items():
    normal, enhanced = definitions.get(str(normal_hash)), definitions.get(str(enhanced_hash))
    if not normal or not enhanced:
        continue
    normal_family = categories.get(normal.get("plug", {}).get("plugCategoryIdentifier"))
    enhanced_family = categories.get(enhanced.get("plug", {}).get("plugCategoryIdentifier"))
    if normal_family == enhanced_family == "trait":
        enhanced_to_normal[int(enhanced_hash)] = int(normal_hash)

verified_normal_hashes = set(enhanced_to_normal.values())
hashes = {}
resolved = {}
for key, groups in sorted(names.items()):
    resolved[key] = {}
    for category, candidates in groups.items():
        normal = [candidate for candidate in candidates
                  if "Enhanced" not in candidate.get("itemTypeDisplayName", "")] or candidates
        # Retain a valid canonical normal definition; choose deterministically otherwise.
        preferred_definition = next(
            (candidate for candidate in normal if candidate["hash"] == canonical.get(key)),
            min(normal, key=lambda candidate: candidate["hash"]),
        )
        # A score's historical canonical hash can have a retired presentation.
        # Use the unique verified normal endpoint when its glyph differs. The
        # relationship is established by exact trait-family definitions and DIM
        # links; icons only determine whether presentation needs updating.
        # Same-glyph representatives keep their existing stable identities.
        linked_normal = [candidate for candidate in normal
                         if candidate["hash"] in verified_normal_hashes]
        if category == "trait" and len(linked_normal) == 1:
            linked_icon = linked_normal[0].get("displayProperties", {}).get("icon")
            preferred_icon = preferred_definition.get("displayProperties", {}).get("icon")
            if linked_icon and preferred_icon and linked_icon != preferred_icon:
                preferred_definition = linked_normal[0]
        preferred = preferred_definition["hash"]
        resolved[key][category] = preferred
        for definition in candidates:
            hashes[definition["hash"]] = [category, preferred]

for enhanced_hash, normal_hash in enhanced_to_normal.items():
    if enhanced_hash in hashes and normal_hash in hashes:
        hashes[enhanced_hash] = hashes[normal_hash]
        normal_name = re.sub(r"\s+", " ", definitions[str(normal_hash)]["displayProperties"]["name"].lower().strip())
        enhanced_name = re.sub(r"\s+", " ", definitions[str(enhanced_hash)]["displayProperties"]["name"].lower().strip())
        resolved[enhanced_name]["trait"] = hashes[normal_hash][1]
        # Accepted sheet spelling is created only when the exact hash relationship is verified.
        resolved.setdefault("enhanced " + normal_name, {})["trait"] = hashes[normal_hash][1]

alias_candidates = {}
for name, families in resolved.items():
    key = re.sub("[^a-z0-9]", "", name)
    for family, identity in families.items():
        alias_candidates.setdefault(key, {}).setdefault(family, set()).add(identity)
aliases = {}
ambiguous = {}
for key, families in alias_candidates.items():
    unique = {family: next(iter(identities)) for family, identities in families.items()
              if len(identities) == 1}
    if unique:
        aliases[key] = unique
    conflicts = [family for family, identities in families.items() if len(identities) > 1]
    if conflicts:
        ambiguous[key] = conflicts

output = (
    "// Generated from Bungie InventoryItem definitions; exact weapon plug families only.\n"
    f"// Manifest {args.version}. See docs/weapon-perk-identity.md.\n"
    "export const WEAPON_PERK_NAMES: Record<string, Partial<Record<string, number>>> = "
    + json.dumps(resolved, separators=(",", ":")) + ";\n"
    "export const WEAPON_PERK_HASHES: Record<number, readonly [string, number]> = "
    + json.dumps(hashes, separators=(",", ":")) + ";\n"
    "export const WEAPON_PERK_ALIASES: Record<string, Partial<Record<string, number>>> = "
    + json.dumps(aliases, separators=(",", ":")) + ";\n"
    "export const WEAPON_PERK_AMBIGUOUS: Record<string, readonly string[]> = "
    + json.dumps(ambiguous, separators=(",", ":")) + ";\n"
)
(root / "src/weapon-perk-identities.ts").write_text(output, encoding="utf-8")
print(f"Indexed {len(hashes)} weapon definitions and {len(resolved)} names.")
