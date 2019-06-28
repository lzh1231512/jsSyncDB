using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace web_netcore.Models
{
    public class UploadResult
    {
        public String uuid { set; get; }
        public int status { set; get; }
        public long lastId { set; get; }
        public List<DBObj> data { set; get; }
    }
}
