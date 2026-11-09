"""Permissions par role. Miroir de DEFAULT_GRANTS du user-service (src/modules/roles/constants/permission.catalog.ts).

Limite connue : les droits peuvent etre modifies par un admin dans le user-service ; ce miroir reflete les
valeurs par defaut. Le user-service reste l'autorite : il refuse de toute facon un appel non autorise.
"""
from app.schemas import Role

ALL_PERMISSIONS = frozenset({
    "users.manage", "users.roles", "academic.view", "academic.manage", "academic.grades",
    "resources.book", "resources.manage", "housing.request", "housing.assign",
    "clubs.join", "clubs.manage", "library.borrow", "library.manage",
})

DEFAULT_GRANTS: dict[Role, frozenset[str]] = {
    "student": frozenset({"academic.view", "housing.request", "library.borrow", "resources.book", "clubs.join"}),
    "teacher": frozenset({"academic.view", "academic.grades", "resources.book", "library.borrow", "clubs.join"}),
    "admin": ALL_PERMISSIONS,
}


def permissions_for(role: Role) -> frozenset[str]:
    return DEFAULT_GRANTS[role]
