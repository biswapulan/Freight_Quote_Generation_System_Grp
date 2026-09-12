import pytest


@pytest.fixture(autouse=True)
def _uploads_go_to_a_temporary_folder(settings, tmp_path):
    """Documents the tests upload are written under a temporary MEDIA_ROOT.

    Reviewers now open every paper before verifying it, so the tests upload
    real files; they should not pile up in server/media.
    """
    settings.MEDIA_ROOT = str(tmp_path / "media")
