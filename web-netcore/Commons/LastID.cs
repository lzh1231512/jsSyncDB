using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace web_netcore.Commons
{
    public class LastID
    {
        private static Dictionary<String, long> Ids = new Dictionary<String, long>();

        public static long? getLastId(String key)
        {
            lock (Ids)
            {
                if (Ids.ContainsKey(key))
                {
                    return Ids[key];
                }
            }
            return null;
        }
        public static void setLastId(String key, long val)
        {
            lock (Ids)
            {
                Ids[key] = val;
            }
        }
    }
}
