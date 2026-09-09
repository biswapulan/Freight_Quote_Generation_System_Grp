"""Company membership lookups, the basis of M4's data isolation rule.

The rule from the milestone document: if a customer selects Company B, only
authorised Company B agents may see that verification request. Company A and C
agents must never see it.

Every check goes through this module so the rule lives in one place. Callers
ask "which companies may this caller act for", never "does this email look
right", which is how the previous email-string comparison worked.
"""

from django.core.exceptions import ValidationError

from .models import CompanyAgent, FreightCompany

# Roles that see the whole platform regardless of company membership.
PLATFORM_WIDE_ROLES = ("admin", "customs", "customs_officer")


def memberships_for(email, *, active_only=True):
    """Every company membership held by this email address."""
    if not email:
        return CompanyAgent.objects.none()
    qs = CompanyAgent.objects.filter(user_email__iexact=email).select_related("company")
    if active_only:
        qs = qs.filter(is_active=True, company__status="ACTIVE")
    return qs


def company_ids_for(email):
    """Ids of the companies this caller may act for. Empty means none."""
    return list(memberships_for(email).values_list("company_id", flat=True))


def company_codes_for(email):
    return list(memberships_for(email).values_list("company__code", flat=True))


def is_platform_wide(role):
    return (role or "").lower() in PLATFORM_WIDE_ROLES


def can_access_company(email, role, company_id):
    """May this caller act on work belonging to the given company?"""
    if is_platform_wide(role):
        return True
    if not company_id:
        return False
    return memberships_for(email).filter(company_id=company_id).exists()


def is_manager_of(email, company_id):
    return memberships_for(email).filter(company_id=company_id, role="MANAGER").exists()


def resolve_company(identifier):
    """Find a company by id or by code, whichever the caller supplied."""
    if not identifier:
        return None
    company = FreightCompany.objects.filter(code__iexact=str(identifier)).first()
    if company:
        return company
    try:
        return FreightCompany.objects.filter(id=identifier).first()
    except (ValidationError, ValueError, TypeError):
        # The identifier was neither a known code nor a well-formed UUID.
        return None


def resolve_user_id(email):
    """Map an email address to the platform user id notifications are keyed by.

    Accounts live in MongoDB, so a company membership stores an email while the
    notification inbox filters on the user id. Sending to the email wrote rows
    addressed to an id nobody has, so the agent was never told about work
    assigned to them. Memberships cache the id once resolved.
    """
    if not email:
        return ""

    membership = (
        CompanyAgent.objects.filter(user_email__iexact=email)
        .exclude(user_id="")
        .first()
    )
    if membership and membership.user_id:
        return membership.user_id

    try:
        from accounts.mongo import users_collection

        user = users_collection.find_one({"email": email.lower()})
    except Exception:
        return ""

    if not user:
        return ""

    user_id = str(user.get("_id", ""))
    if user_id:
        CompanyAgent.objects.filter(user_email__iexact=email, user_id="").update(
            user_id=user_id
        )
    return user_id
