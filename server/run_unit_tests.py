"""Run socket-free tests, also on Windows (collect unreachable SQLite handles before temp cleanup)."""
import gc
import sys
import tempfile
import unittest

cleanup=tempfile.TemporaryDirectory.cleanup
def collect_first(self):
    gc.collect()
    return cleanup(self)

if __name__=='__main__':
    tempfile.TemporaryDirectory.cleanup=collect_first
    modules=sys.argv[1:] or ['test_profiles','test_release_128','test_upgrades','test_admin','test_garage','test_social','test_release_126','test_rankings','test_customization','test_progression','test_developer','test_rooms','test_ice','test_bot_settings','test_season']
    suite=unittest.defaultTestLoader.loadTestsFromNames(modules)
    result=unittest.TextTestRunner(verbosity=1).run(suite)
    sys.exit(not result.wasSuccessful())
