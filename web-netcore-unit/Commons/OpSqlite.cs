using NUnit.Framework;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using web_netcore.Commons;

namespace Tests.Commons
{
    public class OpSqliteUnit
    {
        [Test]
        public void QuickSaveTest()
        {
            var filepath = "1.db";
            try
            {
                File.Delete(filepath);
            }
            catch { }
            OpSqlite.QuickSave("test1", "val1", filepath);
            var val = OpSqlite.getQuickSaveValue("test1", filepath);
            Assert.AreEqual("val1", val);
        }



        [Test]
        public void Test2()
        {
            var filepath = "2.db";
            try
            {
                File.Delete(filepath);
            }
            catch { }
            var localGUID = "localGUID1";
            var uploadGUID = 1;
            var data = new List<DBObj>()
            {
                new DBObj()
                {
                    id=1,
                    objuuid="o1",
                    uuid="u1",
                    data="v1",
                    isDelete=0
                },
                new DBObj()
                {
                    id=2,
                    objuuid="o2",
                    uuid="u2",
                    data="v2",
                    isDelete=0
                }
            };

            OpSqlite.InsertDBObjLst(data, filepath, localGUID, uploadGUID++.ToString(), false);

            var res = OpSqlite.SelectDBObj(0, 100, filepath);
            Assert.AreEqual(2, res.Count);
            Assert.AreEqual("o1", res[0].objuuid);
            Assert.AreEqual("v2", res[1].data);

            var data2 = new List<DBObj>()
            {
                new DBObj()
                {
                    id=1,
                    objuuid="o1",
                    uuid="u1",
                    data="v1",
                    isDelete=1
                }
            };

            OpSqlite.InsertDBObjLst(data2, filepath, localGUID, uploadGUID++.ToString(), false);

            res = OpSqlite.SelectDBObj(0, 100, filepath);

            Assert.AreEqual(1, res.First(f => f.objuuid == "o1").isDelete);

            Assert.AreEqual(3, OpSqlite.getMaxID(filepath).Value);

            Assert.AreEqual(1, OpSqlite.SelectDelIds(0,100,filepath)[0]);
        }
    }
}
