using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace web_netcore
{
    [JsonObject(MemberSerialization.OptOut)]
    public class DBObj
    {
        public long id { set; get; }
        public String objuuid { set; get; }
        public String data { set; get; }
        public int isDelete { set; get; }
        [JsonIgnore]
        public String uuid { set; get; }
        [JsonIgnore]
        public String table { set; get; }

        public static String ToJsonLst(List<DBObj> ObjLst)
        {
            try
            {
                string json = JsonConvert.SerializeObject(ObjLst);
                return json;
            }
            catch
            {
            }
            return null;
        }

        public static List<DBObj> FromJsonLst(String json)
        {
            List<DBObj> res = null;
            try
            {
                res = JsonConvert.DeserializeObject<List<DBObj>>(json);

            }
            catch
            {
            }
            return res;
        }
    }
}
