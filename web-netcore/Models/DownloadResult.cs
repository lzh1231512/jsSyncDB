using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using web_netcore.Commons;

namespace web_netcore.Models
{
    public class DownloadResult
    {
        public List<DBObj> data { set; get; }
        public List<long> delIds { set; get; }
        public int status { set; get; }
        public String uuid { set; get; }
        public long maxId { set; get; }
    }

}
