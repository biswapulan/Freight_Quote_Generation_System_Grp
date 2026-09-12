"""Undo the automatic verification of uploaded documents.

Uploads used to be stamped VERIFIED by "AutoComplianceValidator" the moment
they arrived, and their checklist line marked verified with them, though
nobody had opened those files. They go back to waiting for review, still
counted as on file, so a reviewer opens and verifies each one.
"""

from django.db import migrations


def reset(apps, schema_editor):
    ShipmentDocument = apps.get_model("customs", "ShipmentDocument")
    CustomsChecklistItem = apps.get_model("customs", "CustomsChecklistItem")

    automatic = ShipmentDocument.objects.filter(verified_by="AutoComplianceValidator")
    item_ids = list(
        automatic.exclude(checklist_item=None).values_list("checklist_item_id", flat=True)
    )
    automatic.update(verification_status="PENDING", verified_by=None, verified_at=None)
    CustomsChecklistItem.objects.filter(id__in=item_ids, status="VERIFIED").update(
        status="PENDING", document_uploaded=True
    )


class Migration(migrations.Migration):
    dependencies = [("customs", "0003_manual_document_review")]

    operations = [migrations.RunPython(reset, migrations.RunPython.noop)]
