import Editor, { DiffEditor, useMonaco, loader } from '@monaco-editor/react'
import React, { useRef, useEffect } from 'react'
import Router, { useRouter } from 'next/router'

import ourbigbook from 'ourbigbook/dist/ourbigbook.js';
import { ourbigbook_runtime } from 'ourbigbook/dist/ourbigbook_runtime.js';
import { OurbigbookEditor } from 'ourbigbook/editor.js';
import { convertOptions, convertOptionsJson, isProduction } from 'front/config';

import { ArticlePageProps } from 'front/ArticlePage'
import { slugFromArray } from 'front'
import ListErrors from 'front/ListErrors'
import useLoggedInUser from 'front/useLoggedInUser'
import { webApi } from 'front/api'
import routes from 'front/routes'
import { AppContext, useCtrlEnterSubmit } from 'front'
import { modifyEditorInput } from 'front/js';

export default function ArticleEditorPageHoc(options = { isnew: false}) {
  const { isnew } = options
  const editor = ({ article: initialArticle }: ArticlePageProps) => {
    const router = useRouter();
    const {
      query: { slug },
    } = router;
    let body;
    let slugString
    if (Array.isArray(slug)) {
      slugString = slug.join('/')
    } else {
      slugString = slug
    }
    let initialFileState;
    let initialFile
    if (initialArticle) {
      initialFile = initialArticle.file
      body = initialFile.body
      if (slugString && isnew) {
        body += `${ourbigbook.PARAGRAPH_SEP}Adapted from: \\x[${ourbigbook.AT_MENTION_CHAR}${slugString}].`
      }
      initialFileState = {
        title: initialFile.title,
      }
    } else {
      body = ""
      initialFileState = {
        title: "",
      }
    }
    const [isLoading, setLoading] = React.useState(false);
    const [errors, setErrors] = React.useState([]);
    const [file, setFile] = React.useState(initialFileState);
    const ourbigbookEditorElem = useRef(null);
    const loggedInUser = useLoggedInUser()
    useEffect(() => {
      if (ourbigbookEditorElem && loggedInUser) {
        let editor;
        loader.init().then(monaco => {
          //const id = ourbigbook.title_to_id(file.title)
          //const input_path = `${ourbigbook.AT_MENTION_CHAR}${loggedInUser.username}/${id}${ourbigbook.OURBIGBOOK_EXT}`
          editor = new OurbigbookEditor(
            ourbigbookEditorElem.current,
            body,
            monaco,
            ourbigbook,
            ourbigbook_runtime,
            {
              convertOptions: Object.assign({
                input_path: initialFile?.path,
                ref_prefix: `${ourbigbook.AT_MENTION_CHAR}${loggedInUser.username}`,
                ourbigbook_json: convertOptionsJson,
              }, convertOptions),
              handleSubmit,
              modifyEditorInput: (oldInput) => modifyEditorInput(file.title, oldInput),
              production: isProduction,
            },
          )
          ourbigbookEditorElem.current.ourbigbookEditor = editor
        })
        return () => {
          // TODO cleanup here not working.
          // Blows exception when changing page title because scroll callback calls for the new page.
          // This also leads the redirected article page to be at a random scroll and not on top.
          // Maybe try to extract a solution from:
          // https://github.com/suren-atoyan/monaco-react/blob/9acaf635caf6d738173e53434984252baa8b06d9/src/Editor/Editor.js
          // What happens: order is ArticlePage -> onDidScrollChange -> dispose
          // but we need dispose to be the first thing.
          //ourbigbookEditorRef.current.ourbigbookEditor.dispose()
          if (editor) {
            editor.dispose()
          }
        };
      }
    }, [loggedInUser?.username])
    const handleTitle = async (e) => {
      setFile(file => { return {
        ...file,
        title: e.target.value,
      }})
      await ourbigbookEditorElem.current.ourbigbookEditor.setModifyEditorInput(
        oldInput => modifyEditorInput(e.target.value, oldInput))
    }
    const handleSubmit = async (e) => {
      if (e) {
        e.preventDefault();
      }
      setLoading(true);
      let data, status;
      file.body = ourbigbookEditorElem.current.ourbigbookEditor.getValue()
      if (isnew) {
        ({ data, status } = await webApi.articleCreate(file));
      } else {
        ({ data, status } = await webApi.articleCreateOrUpdate(
          file,
          {
            path: slugFromArray(initialFile.path.split(ourbigbook.Macro.HEADER_SCOPE_SEPARATOR), { username: false }),
          }
        ));
      }
      setLoading(false);
      if (status !== 200) {
        setErrors(data.errors);
      }

      // This is a hack for the useEffect cleanup callback issue.
      ourbigbookEditorElem.current.ourbigbookEditor.dispose()

      let redirTarget
      if (isnew) {
        redirTarget = routes.articleView(data.articles[0].slug)
      } else {
        redirTarget = routes.articleView((slug as string[]).join('/'))
      }
      Router.push(redirTarget, null, { scroll: true });
    };
    useCtrlEnterSubmit(handleSubmit)
    const handleCancel = async (e) => {
      if (isnew) {
        Router.push(`/`);
      } else {
        // This is a hack for the useEffect cleanup callback issue.
        ourbigbookEditorElem.current.ourbigbookEditor.dispose()
        Router.push(routes.articleView(initialArticle.slug));
      }
    }
    const { setTitle } = React.useContext(AppContext)
    React.useEffect(() => {
      setTitle(isnew ? 'New article' : `Editing: ${initialFile?.title}`)
    }, [isnew, initialFile?.title])
    return (
      <div className="editor-page content-not-ourbigbook">
        { /* <ListErrors errors={errors} /> */ }
        <form className="editor-form">
          <div className="title-and-actions">
            <input
              type="text"
              className="title"
              placeholder="Article Title"
              value={file.title}
              onChange={handleTitle}
            />
            <div className="actions">
              <button
                className="btn"
                type="button"
                onClick={handleCancel}
              >
                <i className="ion-close" />&nbsp;Cancel
              </button>
              <button
                className="btn"
                type="button"
                disabled={isLoading}
                onClick={handleSubmit}
              >
                <i className="ion-checkmark" />&nbsp;{isnew ? 'Create' : 'Submit'}
              </button>
            </div>
          </div>
          <div
            className="ourbigbook-editor"
            ref={ourbigbookEditorElem}
          >
          </div>
        </form>
      </div>
    );
  };
  editor.isEditor = true;
  return editor;
}
