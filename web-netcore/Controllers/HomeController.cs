using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using web_netcore.Commons;
using web_netcore.Models;
using System.IO;
using System.Threading;
using System.Net;

namespace web_netcore.Controllers
{
    public class HomeController : Controller
    {
        private readonly IHostingEnvironment _hostingEnvironment;

        public HomeController(IHostingEnvironment hostingEnvironment)
        {
            _hostingEnvironment = hostingEnvironment;
        }


        public IActionResult Index()
        {
            return View();
        }

        [HttpPost]
        public IActionResult DownloadDBObj(String code, String DBName, int beginId, int take,
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
            lock(locker)
            {
                dbUUid = OpSqlite.getQuickSaveValue("uuid", path);
                lastId = OpSqlite.getMaxID(path) ?? 0;
                LastID.setLastId(path, lastId);
                dr.maxId = lastId;
                if (dbUUid!=(uuid) && !string.IsNullOrEmpty(uuid))
                {
                    if (lastId == 0)
                    {
                        dr.status=(-2);
                    }
                    else
                    {
                        dr.status=(-1);
                    }
                }
                else if (beginId - 1 > lastId)
                {
                    dr.status=(-2);
                }
            }

            if (dr.status != -1 && dr.status != -2)
            {
                int jsq = 0;
                while (lastId != 0 && lastId < (long)beginId && jsq < 120 && "1"==(isWait))
                {
                    Thread.Sleep(500);
                    lastId = LastID.getLastId(path)??0;
                    jsq++;
                }
                lock(locker)
                {
                    dr.status=(1);
                    List<DBObj> db = OpSqlite.SelectDBObj(beginId, take, path);
                    dr.uuid=(dbUUid);
                    dr.data=(db);
                    dr.maxId=(lastId);
                    if (db.Count> 0)
                    {
                        List<long> dels = OpSqlite.SelectDelIds(db[(0)].id, db[(db.Count - 1)].id, path);
                        dr.delIds=(dels);
                    }
                }
            }

            return Json(dr);
        }

        [HttpPost]
        public IActionResult UploadDBObj(String code, String DBName, long localMaxId, 
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
                lastID = OpSqlite.getMaxID(path)??0;
                String dbUUid = OpSqlite.getQuickSaveValue("uuid", path);
                
                resObj.status=(-9);
                resObj.uuid=(dbUUid);
                var iswrite = true;
                var isUUIDMatch = dbUUid == (uuid) || string.IsNullOrEmpty(uuid);
                if (!isUUIDMatch || lastID < localMaxId)
                {
                    if ((isUUIDMatch && lastID < localMaxId) || (!isUUIDMatch && (lastID == 0L) && "1"!=(restore)))
                    {
                        resObj.status=(-2);
                        resObj.lastId=(lastID);
                        iswrite = false;
                    }
                    else if ("1"==(restore) && (lastID == 0))
                    {
                        OpSqlite.QuickSave("uuid", uuid, path);
                    }
                    else
                    {
                        resObj.status=(-1);
                        iswrite = false;
                    }
                }
                if (iswrite)
                {
                    List<DBObj> db = DBObj.FromJsonLst(Data);
                    if (db != null && db.Count > 0)
                    {
                        long insertResult = OpSqlite.InsertDBObjLst(db, path, localUUID, uploadUUID, "1"==(restore));
                        if (insertResult != 0)
                        {
                            resObj.status=(1);
                            for (int i = 0; i < db.Count; i++)
                            {
                                db[(i)].data=("");
                                if ("1"!=(restore))
                                    db[(i)].id=(insertResult++);
                            }
                            resObj.data=(db);
                        }
                        if ("1"==(restore))
                        {
                            lastID = OpSqlite.getMaxID(path)??0;
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

        public IActionResult GetIconServlet(String type, String domain)
        {
            var filePath = Configs.tempPath;
            var tempFilePath = "wd.jpg";
            filePath = _hostingEnvironment.WebRootPath.TrimEnd('\\', '/')
               + "/" + filePath.TrimEnd('\\', '/') + "/";
            System.IO.Directory.CreateDirectory(filePath);

            tempFilePath= _hostingEnvironment.ContentRootPath.TrimEnd('\\', '/')
               + "/" + tempFilePath;
            Response.ContentType = "image/x-icon";
            Response.Headers.Add("expires", "Fri Feb 01 2999 00:00:00 GMT+0800");
            String p = filePath + "/" + domain + ".ico";
            if (!System.IO.File.Exists(p))
            {
                try
                {
                    String url = (type==("1") ? "http" : "https") + "://" + domain + "/favicon.ico";
                    if (HttpDownload(url, p))
                    {
                        return File(new FileStream(p, FileMode.Open), "image/x-icon");
                    }
                    else
                    {
                        if (System.IO.File.Exists(p))
                        {
                            System.IO.File.Delete(p);
                        }
                    }
                }
                catch (Exception e)
                {
                }
            }
            return File(new FileStream(tempFilePath, FileMode.Open), "image/x-icon");
        }

        public static bool HttpDownload(string url, string filePath)
        {
            try
            {
                string fileName = Path.GetFileName(url);
                if (System.IO.File.Exists(filePath)) {
                    System.IO.File.Delete(filePath);
                }
                FileStream fs = new FileStream(filePath, FileMode.Append, FileAccess.Write, FileShare.ReadWrite);
                HttpWebRequest request = WebRequest.Create(url) as HttpWebRequest; 
                HttpWebResponse response = request.GetResponse() as HttpWebResponse; 
                Stream responseStream = response.GetResponseStream(); 
                byte[] bArr = new byte[1024];
                int iTotalSize = 0;
                int size = responseStream.Read(bArr, 0, (int)bArr.Length);
                while (size > 0)
                {
                    iTotalSize += size;
                    fs.Write(bArr, 0, size);
                    size = responseStream.Read(bArr, 0, (int)bArr.Length);
                }
                fs.Close();
                responseStream.Close();
                return true;
            }
            catch
            {
                return false;
            }
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}
