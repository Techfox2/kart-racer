import base64
import hashlib
import hmac
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import ice

class IceTests(unittest.TestCase):
    def test_credentials_and_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'turn.json'
            with patch.dict(os.environ, KART_TURN_CONFIG=str(path)):
                self.assertFalse(ice.configuration(7, 100)['relayAvailable'])
                secret = 'a' * 64
                urls = ['turns:relay.example.org:443?transport=tcp']
                path.write_text(json.dumps(dict(secret=secret, urls=urls)))
                config = ice.configuration(7, 100)
                self.assertTrue(config['relayAvailable'])
                self.assertEqual(config['expires'], 3700)
                relay = config['iceServers'][-1]
                self.assertTrue(relay['username'].startswith('3700:'))
                expected = base64.b64encode(hmac.new(secret.encode(), relay['username'].encode(), hashlib.sha1).digest()).decode()
                self.assertEqual(relay['credential'], expected)
                self.assertNotEqual(relay['username'], ice.configuration(8, 100)['iceServers'][-1]['username'])
                self.assertNotIn(secret, json.dumps(config))
                path.write_text('{bad')
                self.assertFalse(ice.configuration(7)['relayAvailable'])

if __name__ == '__main__': unittest.main()
