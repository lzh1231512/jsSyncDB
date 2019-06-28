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
    public class UploadDBObjController : Controller
    {
        private readonly IHostingEnvironment _hostingEnvironment;

        public UploadDBObjController(IHostingEnvironment hostingEnvironment)
        {
            _hostingEnvironment = hostingEnvironment;
        }

        public IActionResult Index(String code, String DBName, long localMaxId,
            String uuid, String Data, String restore, String localUUID, String uploadUUID)
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
            var locker = SqliteLock.getLockObj(path);
            long lastID = 0L;
            UploadResult resObj = new UploadResult();
            lock (locker)
            {
                lastID =  OpSqlite.getMaxID(path) ?? 0;
                String dbUUid =  OpSqlite.getQuickSaveValue("uuid", path);

                resObj.status = (-9);
                resObj.uuid = (dbUUid);
                var iswrite = true;
                var isUUIDMatch = dbUUid == (uuid) || string.IsNullOrEmpty(uuid);
                if (!isUUIDMatch || lastID < localMaxId)
                {
                    if ((isUUIDMatch && lastID < localMaxId) || (!isUUIDMatch && (lastID == 0L) && "1" != (restore)))
                    {
                        resObj.status = (-2);
                        resObj.lastId = (lastID);
                        iswrite = false;
                    }
                    else if ("1" == (restore) && (lastID == 0))
                    {
                         OpSqlite.QuickSave("uuid", uuid, path);
                    }
                    else
                    {
                        resObj.status = (-1);
                        iswrite = false;
                    }
                }
                if (iswrite)
                {
                    List<DBObj> db = DBObj.FromJsonLst(Data);
                    if (db != null && db.Count > 0)
                    {
                        long insertResult =  OpSqlite.InsertDBObjLst(db, path, localUUID, uploadUUID, "1" == (restore));
                        if (insertResult != 0)
                        {
                            resObj.status = (1);
                            for (int i = 0; i < db.Count; i++)
                            {
                                db[(i)].data = ("");
                                if ("1" != (restore))
                                    db[(i)].id = (insertResult++);
                            }
                            resObj.data = (db);
                        }
                        if ("1" == (restore))
                        {
                            lastID =  OpSqlite.getMaxID(path) ?? 0;
                        }
                        else
                        {
                            lastID = insertResult - 1;
                        }
                    }
                }
            }
            if (lastID != 0L)
            {
                LastID.setLastId(path, lastID);
            }
            return Json(resObj);
        }
    }
}