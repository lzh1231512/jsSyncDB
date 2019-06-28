using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using web_netcore.Commons;
using web_netcore.Models;

namespace web_netcore.Controllers
{
    public class DownloadDBObjController : Controller
    {

        private readonly IHostingEnvironment _hostingEnvironment;

        public DownloadDBObjController(IHostingEnvironment hostingEnvironment)
        {
            _hostingEnvironment = hostingEnvironment;
        }


        public IActionResult Index(String code, String DBName, int beginId, int take,
            String uuid, String isWait)
        {
            var filePath = Configs.uploadFilePath;
            filePath = _hostingEnvironment.WebRootPath.TrimEnd('\\', '/')
                + "/" + filePath.TrimEnd('\\', '/') + "/";
            System.IO.Directory.CreateDirectory(filePath);

            Response.ContentType = "text/plain;charset=utf-8";
            Response.Headers.Add("Access-Control-Allow-Origin", "*");
            Response.Headers.Add("Access-Control-Allow-Methods", "POST");
            Response.Headers.Add("Access-Control-Allow-Headers", "x-requested-with,content-type");

            String ml = filePath + "/" + code + "/";
            System.IO.Directory.CreateDirectory(ml);

            String path = filePath + "/" + code + "/" + DBName + ".db";
            var lastId = 0L;
            var locker = SqliteLock.getLockObj(path);
            String dbUUid = null;
            DownloadResult dr = new DownloadResult();
            lock (locker)
            {
                dbUUid =  OpSqlite.getQuickSaveValue("uuid", path);
                lastId =  OpSqlite.getMaxID(path) ?? 0;
                LastID.setLastId(path, lastId);
                dr.maxId = lastId;
                if (dbUUid != (uuid) && !string.IsNullOrEmpty(uuid))
                {
                    if (lastId == 0)
                    {
                        dr.status = (-2);
                    }
                    else
                    {
                        dr.status = (-1);
                    }
                }
                else if (beginId - 1 > lastId)
                {
                    dr.status = (-2);
                }
            }

            if (dr.status != -1 && dr.status != -2)
            {
                int jsq = 0;
                while (lastId != 0 && lastId < (long)beginId && jsq < 120 && "1" == (isWait))
                {
                    Thread.Sleep(500);
                    lastId = LastID.getLastId(path) ?? 0;
                    jsq++;
                }
                lock (locker)
                {
                    dr.status = (1);
                    List<DBObj> db =  OpSqlite.SelectDBObj(beginId, take, path);
                    dr.uuid = (dbUUid);
                    dr.data = (db);
                    dr.maxId = (lastId);
                    if (db.Count > 0)
                    {
                        List<long> dels =  OpSqlite.SelectDelIds(db[(0)].id, db[(db.Count - 1)].id, path);
                        dr.delIds = (dels);
                    }
                }
            }

            return Json(dr);
        }
    }
}