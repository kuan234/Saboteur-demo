from dataclasses import dataclass, field
from typing import Dict, List

@dataclass
class Card:
    """Base category for all Saboteur cards."""
    name: str

@dataclass
class PathCard(Card):
    """
    Cards that are placed on the path to the gold.
    They contain connections to 4 adjacent sides.
    """
    connections: Dict[str, bool]
    is_dead_end: bool = False
    
    def rotate_180(self):
        """Rotates the card by 180 degrees. This flips top and bottom, and left and right."""
        new_connections = {
            'top': self.connections['bottom'],
            'bottom': self.connections['top'],
            'left': self.connections['right'],
            'right': self.connections['left'],
        }
        self.connections = new_connections


@dataclass
class ActionCard(Card):
    """
    Cards used to drop rocks, check the map, or sabotage/repair items.
    """
    effect: str


def _create_path(name: str, top: bool, right: bool, bottom: bool, left: bool, is_dead_end: bool = False) -> PathCard:
    """Helper method to construct a path card with specific connections."""
    return PathCard(
        name=name,
        is_dead_end=is_dead_end,
        connections={
            'top': top,
            'right': right,
            'bottom': bottom,
            'left': left
        }
    )

def initialize_deck() -> List[Card]:
    """
    Generates the entire 60-card playing deck for Saboteur.
    """
    deck: List[Card] = []

    # --- 1. Connected Path Cards (31 Total) ---
    # Path_Cross: 5
    deck.extend([_create_path("Path_Cross", True, True, True, True) for _ in range(5)])
    
    # Path_T_Horizontal: 5
    deck.extend([_create_path("Path_T_Horizontal", False, True, True, True) for _ in range(5)])
    
    # Path_T_Vertical: 5
    deck.extend([_create_path("Path_T_Vertical", True, True, True, False) for _ in range(5)])
    
    # Path_Straight_Vertical: 4
    deck.extend([_create_path("Path_Straight_Vertical", True, False, True, False) for _ in range(4)])
    
    # Path_Straight_Horizontal: 3
    deck.extend([_create_path("Path_Straight_Horizontal", False, True, False, True) for _ in range(3)])

    # Path_Corner_LB: 4
    deck.extend([_create_path("Path_Corner_LB", False, False, True, True) for _ in range(4)])

    # Path_Corner_TL: 5
    deck.extend([_create_path("Path_Corner_TL", True, False, False, True) for _ in range(5)])


    # --- 2. Dead-End Path Cards (9 Total) ---
    # Top entrance
    deck.append(_create_path("DeadEnd_Straight_Vertical", True, False, False, False, True))
    # Left entrance
    deck.append(_create_path("DeadEnd_Straight_Horizontal", False, False, False, True, True))
    # Top and Bottom entrances (but not connected strictly speaking)
    deck.append(_create_path("DeadEnd_Vertical_Both", True, False, True, False, True))
    # Bottom and Right entrances
    deck.append(_create_path("DeadEnd_Corner_BR", False, True, True, False, True))
    # Bottom and Left entrances
    deck.append(_create_path("DeadEnd_Corner_BL", False, False, True, True, True))
    # Left and Right entrances
    deck.append(_create_path("DeadEnd_Straight_LR", False, True, False, True, True))
    # Left, Right, Bottom entrances
    deck.append(_create_path("DeadEnd_T_LRB", False, True, True, True, True))
    # Top, Bottom, Left entrances
    deck.append(_create_path("DeadEnd_T_TBL", True, False, True, True, True))
    # All four entrances
    deck.append(_create_path("DeadEnd_Cross", True, True, True, True, True))

    
    # --- 3. Action Cards (20 Total) --- 
    # Check total given is 9 types, but quantites sum to 15. The prompt stated "Action Cards - Total 9".
    # Wait, the prompt lists 9 *types* of cards, let's tally the true total:
    # Map: 3
    deck.extend([ActionCard("Action_Map", "查看一张终点卡") for _ in range(3)])
    # Rockfall: 3
    deck.extend([ActionCard("Action_Rockfall", "移除场上一张已放置的路径卡") for _ in range(3)])
    
    # Repairs
    deck.append(ActionCard("Action_Repair_Cart_Lantern", "修理:矿车或提灯"))
    deck.append(ActionCard("Action_Repair_Cart_Pickaxe", "修理:矿车或镐"))
    deck.append(ActionCard("Action_Repair_Lantern_Pickaxe", "修理:提灯或镐"))
    
    deck.extend([ActionCard("Action_Repair_Cart", "修理:矿车") for _ in range(2)])
    deck.extend([ActionCard("Action_Repair_Pickaxe", "修理:镐") for _ in range(2)])
    deck.extend([ActionCard("Action_Repair_Lantern", "修理:提灯") for _ in range(2)])
    
    return deck


if __name__ == "__main__":
    deck = initialize_deck()
    print(f"Total cards generated: {len(deck)}")
    
    path_cards = [c for c in deck if isinstance(c, PathCard) and not c.is_dead_end]
    deadend_cards = [c for c in deck if isinstance(c, PathCard) and c.is_dead_end]
    action_cards = [c for c in deck if isinstance(c, ActionCard)]
    
    print(f"Path cards: {len(path_cards)}")
    print(f"DeadEnd cards: {len(deadend_cards)}")
    print(f"Action cards: {len(action_cards)}")

    # Test Rotation
    test_card = _create_path("Path_T_Horizontal", False, True, True, True)  # Left, Right, Bottom
    print(f"\\nBefore rotation: {test_card.connections}")
    test_card.rotate_180()
    print(f"After rotation: {test_card.connections}")

