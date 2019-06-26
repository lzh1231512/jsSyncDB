using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace web_netcore.Commons
{
    public class SqliteLock
    {
        private static Dictionary<String, Object> lockObjs = new Dictionary<String, Object>();

        public static Object getLockObj(String key)
        {
            if (lockObjs.ContainsKey(key))
            {
                return lockObjs[key];
            }
            Object res = new Object();
            lockObjs[key] = res;
            return res;
        }
    }
}
