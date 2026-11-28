"""Regress scoped figure removals, clearances and meeting-facing corrections."""
from pathlib import Path
import math
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
assert (ROOT/'tools/field_scene_people.py').is_file(), 'Missing scoped figure placement fixes'
from field_scene_people import scene_actor_edit


class FigureFixes(unittest.TestCase):
    def test_ruijin_courtyard_uses_farmer(self):
        result=scene_actor_edit('ruijin',-1.4,-1.1,3.65,'walk','local')
        self.assertEqual(result['role'],'farmer')
        self.assertEqual(result['position'],[-1.4,-1.1,3.65])

    def test_reader_clears_left_wing_wall(self):
        result=scene_actor_edit('ruijin',-2.76,-.02,3.66,'write','local')
        self.assertEqual(result['position'],[-1.85,-.02,3.66])
        self.assertGreater(result['position'][0]-.30,-2.65+.25)

    def test_exactly_two_bridge_greeters_removed(self):
        for x,y in [(-2.1,.33),(-.5,-.33)]:
            self.assertTrue(scene_actor_edit('dawei',x,y,2.89,'greet','walker')['remove'])
        for x,y in [(-5.3,.33),(-3.7,-.33),(1.1,.33)]:
            self.assertIsNone(scene_actor_edit('dawei',x,y,2.89,'walk','walker'))

    def test_other_people_and_stations_are_untouched(self):
        for sid in ['luding','yudu','zunyi','ruijin','dawei']:
            self.assertIsNone(scene_actor_edit(sid,12.23,-5.74,2.22,'stand','porter'))
        self.assertIsNone(scene_actor_edit('dawei',-8.05,-.09,2.2,'greet','local'))
        self.assertIsNone(scene_actor_edit('ruijin',2,-4.9,1.5,'stand','local'))

    def test_meeting_rows_face_table_and_clear_porch(self):
        front=scene_actor_edit('lianghekou',0,.3,.25,'sit','local')
        back=scene_actor_edit('lianghekou',0,3.3,.25,'sit','local')
        self.assertEqual(front['yaw'],math.pi)
        self.assertEqual(back['yaw'],0)
        self.assertEqual(front['position'],[0,-2.9,.165])
        self.assertEqual(back['position'],[0,.5,.165])
        self.assertLess(back['position'][1]+.40,1.345)
        self.assertEqual(back['role'],'delegate')

    def test_liping_removes_every_repeated_market_porter(self):
        for x,y in [(-1.2,-10.2),(-.27,-10.620735),(.66,-10.654649),(2.52,-9.821599)]:
            self.assertTrue(scene_actor_edit('liping',x,y,.28,'walk','local')['remove'])
        self.assertEqual(scene_actor_edit('liping',1.59,-10.27056,.28,'walk','local')['asset'],'seated-civilian-woman')
        self.assertEqual(scene_actor_edit('liping',-5.4,-6.8,.28,'stand','local')['position'],[-2,-7.5,.24])

    def test_chishui_removes_crowded_house_extras(self):
        for x in [-16.9,-12,-7.1,-2.2,2.7,7.6,12.5]:
            self.assertTrue(scene_actor_edit('chishui',x,5.1,1.92,'walk','porter')['remove'])
        self.assertEqual(scene_actor_edit('chishui',2.1,3.1,1.885,'greet','porter')['asset'],'marcher-male')

    def test_zunyi_different_actor_on_flat_forecourt(self):
        a=scene_actor_edit('zunyi',.55,-4.4,.32,'stand','local')
        b=scene_actor_edit('zunyi',1.2,-4.1,.32,'stand','local')
        self.assertNotEqual(a['asset'],b['asset'])
        self.assertLess(a['position'][1]+.5,-4.8)
        self.assertLess(b['position'][1]+.5,-4.8)

    def test_baxi_audience_and_speaker_face_each_other(self):
        self.assertEqual(scene_actor_edit('baxi',-2,-1,.25,'sit','local')['yaw'],math.pi)
        self.assertEqual(scene_actor_edit('baxi',0,1.4,.9,'greet','local')['yaw'],0)


if __name__=='__main__':unittest.main()
