import axios from "axios";
import Router, { useRouter } from "next/router";
import React from "react";
import useSWR from "swr";

import ListErrors from "../../components/common/ListErrors";
import TagInput from "../../components/editor/TagInput";
import ArticleAPI from "../../lib/api/article";
import { SERVER_BASE_URL } from "../../lib/utils/constant";
import storage from "../../lib/utils/storage";

function editorReducer(state, action) {
  switch (action.type) {
    case "SET_TITLE":
      return {
        ...state,
        title: action.text
      };
    case "SET_BODY":
      return {
        ...state,
        body: action.text
      };
    case "ADD_TAG":
      return {
        ...state,
        tagList: state.tagList.concat(action.tag)
      };
    case "REMOVE_TAG":
      return {
        ...state,
        tagList: state.tagList.filter(tag => tag !== action.tag)
      };
    default:
      throw new Error("Unhandled action");
  }
};

export default function makeArticleEditor(isnew: boolean = false) {
  return ({ article: initialArticle }) => {
    const initialState = {
      title: initialArticle.title,
      body: initialArticle.body,
      tagList: initialArticle.tagList,
    };
    const [isLoading, setLoading] = React.useState(false);
    const [errors, setErrors] = React.useState([]);
    const [posting, dispatch] = React.useReducer(editorReducer, initialState);
    const { data: currentUser } = useSWR("user", storage);
    const router = useRouter();
    const {
      query: { pid },
    } = router;
    const handleTitle = (e) =>
      dispatch({ type: "SET_TITLE", text: e.target.value });
    const handleBody = (e) =>
      dispatch({ type: "SET_BODY", text: e.target.value });
    const addTag = (tag) => dispatch({ type: "ADD_TAG", tag: tag });
    const removeTag = (tag) => dispatch({ type: "REMOVE_TAG", tag: tag });
    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      let data, status;
      if (isnew) {
        ({ data, status } = await ArticleAPI.create(
          posting,
          currentUser?.token
        ));
      } else {
        ({ data, status } = await ArticleAPI.update(
          posting,
          router.query.pid,
          currentUser?.token
        ));
      }
      setLoading(false);
      if (status !== 200) {
        setErrors(data.errors);
      }
      Router.push(`/`);
    };
    return (
      <div className="editor-page">
        <div className="container page">
          <div className="row">
            <div className="col-md-10 offset-md-1 col-xs-12">
              <ListErrors errors={errors} />
              <form>
                <fieldset>
                  <fieldset className="form-group">
                    <input
                      className="form-control form-control-lg"
                      type="text"
                      placeholder="Article Title"
                      value={posting.title}
                      onChange={handleTitle}
                    />
                  </fieldset>
                  <fieldset className="form-group">
                    <textarea
                      className="form-control"
                      rows={8}
                      placeholder="Write your article (in Cirodown)"
                      value={posting.body}
                      onChange={handleBody}
                    />
                  </fieldset>
                  <TagInput
                    tagList={posting.tagList}
                    addTag={addTag}
                    removeTag={removeTag}
                  />
                  <button
                    className="btn btn-lg pull-xs-right btn-primary"
                    type="button"
                    disabled={isLoading}
                    onClick={handleSubmit}
                  >
                    {isnew ? 'Publish' : 'Update'} Article
                  </button>
                </fieldset>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  };
}
