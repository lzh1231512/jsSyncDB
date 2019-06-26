using NUnit.Framework;
using System;
using System.Collections.Generic;
using System.Text;
using web_netcore.Commons;

namespace Tests.Commons
{
    public class DBObjTest
    {
        [Test]
        public void Test1()
        {
            String str = "[{\"isDelete\":0,\"objuuid\":\"y9zGSfaAwbsHYBjDAg4PdA\",\"uuid\":51,\"table\":\"mainSync\",\"data\":\"\",\"id\":51}]";
            List<DBObj> obj = DBObj.FromJsonLst(str);
            Assert.AreEqual(0, obj[0].isDelete);
            Assert.AreEqual("y9zGSfaAwbsHYBjDAg4PdA", obj[0].objuuid);
            Assert.AreEqual(51, obj[0].id);
        }
    }
}
