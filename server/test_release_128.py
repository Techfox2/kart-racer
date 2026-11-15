import json,sqlite3,unittest
import rankings,profiles,admin
from rooms import Broker
class Reviews(unittest.TestCase):
 def setUp(self):
  self.c=sqlite3.connect(':memory:');self.c.row_factory=sqlite3.Row
  self.c.execute('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT)')
  self.c.executemany('INSERT INTO users VALUES (?,?)',[(1,'MrBucks'),(2,'Driver'),(3,'Other')]);profiles.migrate(self.c);self.c.commit();admin.migrate(self.c);self.c.commit()
 def tearDown(self):self.c.close()
 def put(self,uid,t):return rankings.record(self.c,uid,{'kart-save':json.dumps({'records':{'competitive:kart:indoor':t}})},True)
 def test_boundary_review_atomic(self):
  self.put(3,24);self.put(2,19.9)
  self.assertEqual(self.c.execute('SELECT count(*) FROM lap_records WHERE user_id=2').fetchone()[0],0)
  r=self.c.execute('SELECT id FROM record_reviews WHERE user_id=2').fetchone()[0];self.c.commit()
  with self.assertRaises(profiles.ProfileError):
   with self.c:admin.action(self.c,2,'review-record',dict(review=r,decision='approved'),Broker())
  with self.c:result=admin.action(self.c,1,'review-record',dict(review=r,decision='approved'),Broker())
  self.assertEqual(result['reward'],400)
  with self.c:self.assertEqual(admin.action(self.c,1,'review-record',dict(review=r,decision='approved'),Broker())['reward'],0)
  self.assertEqual(rankings.board(self.c,2,'indoor','kart','competitive','kart')['entries'][0]['milliseconds'],19900)
  self.put(2,20);self.assertEqual(self.c.execute('SELECT milliseconds FROM lap_records WHERE user_id=2').fetchone()[0],19900)
 def test_twenty_normal_and_migration(self):
  self.put(2,20);self.assertEqual(self.c.execute('SELECT milliseconds FROM lap_records WHERE user_id=2').fetchone()[0],20000)
  self.c.execute('UPDATE lap_records SET milliseconds=19900');rankings.migrate(self.c)
  self.assertEqual(self.c.execute('SELECT count(*) FROM lap_records').fetchone()[0],0)
  self.assertEqual(self.c.execute('SELECT status FROM record_reviews').fetchone()[0],'pending')
 def test_self_rejection_no_reopen(self):
  self.put(1,19.9);r=self.c.execute('SELECT id FROM record_reviews').fetchone()[0];self.c.commit()
  with self.assertRaises(profiles.ProfileError):
   with self.c:admin.action(self.c,1,'review-record',dict(review=r,decision='approved'),Broker())
  self.put(2,19.8);r=self.c.execute('SELECT id FROM record_reviews WHERE user_id=2').fetchone()[0];self.c.commit()
  with self.c:admin.action(self.c,1,'review-record',dict(review=r,decision='rejected',reason='test'),Broker())
  self.put(2,19.8);self.assertEqual(self.c.execute('SELECT status FROM record_reviews WHERE user_id=2').fetchone()[0],'rejected')
if __name__=='__main__':unittest.main()
